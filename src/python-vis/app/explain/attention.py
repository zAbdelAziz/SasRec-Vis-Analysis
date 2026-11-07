"""Capture actual per-head probabilities without modifying the shared model."""
from copy import deepcopy
import numpy as np


class AttentionExtractor:
    def __init__(self, adapter):
        self.adapter = adapter
        # Private copy prevents hook interference with concurrent inference jobs.
        self.model = deepcopy(adapter.require_ready()).eval()
        if not getattr(self.model, 'attention_layers', None):
            raise ValueError('This model does not expose SASRec attention layers')

    def snapshot(self, history, layer=0, head=-1):
        import torch
        model = self.model
        if not 0 <= layer < len(model.attention_layers):
            raise ValueError('Attention layer is outside the loaded model')
        block = model.attention_layers[layer]
        if not -1 <= head < block.num_heads:
            raise ValueError('Attention head is outside the loaded model')
        maxlen = int(self.adapter.config['maxlen'])
        items = history[-maxlen:]
        if any(item <= 0 or item > model.item_num for item in items):
            raise ValueError('Only valid non-padding model item IDs are allowed')
        if not items:
            raise ValueError('Attention requires a nonempty history')
        seq = np.zeros((1, maxlen), dtype=np.int64)
        seq[0, -len(items):] = items
        captured = []
        def options(module, args, kwargs):
            return args, dict(kwargs, need_weights=True, average_attn_weights=False)
        def collect(module, args, output):
            captured.append(output[1].detach().cpu().numpy()[0])
        with torch.inference_mode():
            before = model.log2feats(seq)
            hooks = [block.register_forward_pre_hook(options, with_kwargs=True),
                     block.register_forward_hook(collect)]
            try:
                after = model.log2feats(seq)
            finally:
                for hook in hooks:
                    hook.remove()
            torch.testing.assert_close(before, after, atol=1e-6, rtol=1e-5)
            before_logits = model.item_emb.weight @ before[0, -1]
            after_logits = model.item_emb.weight @ after[0, -1]
            torch.testing.assert_close(before_logits, after_logits, atol=1e-5, rtol=1e-5)
            logit_error = float((before_logits-after_logits).abs().max())
        weights = captured[0]
        if not np.isfinite(weights).all() or np.any(weights < -1e-7):
            raise ValueError('Invalid attention probabilities')
        np.testing.assert_allclose(weights.sum(axis=-1), 1, atol=1e-5)
        if np.max(np.abs(np.triu(weights, 1))) > 1e-7:
            raise ValueError('Causal attention mask violated')
        chosen = weights.mean(axis=0) if head == -1 else weights[head]
        valid = chosen[-len(items):, -len(items):]
        padding = chosen[-len(items):, :maxlen-len(items)].sum(axis=-1)
        np.testing.assert_allclose(valid.sum(axis=-1)+padding, 1, atol=1e-5)
        return {'items': items, 'attention': valid,
                'row_real_mass': valid.sum(axis=-1).tolist(),
                'row_padding_mass': padding.tolist(),
                'normalization_max_error': float(np.max(np.abs(weights.sum(axis=-1)-1))),
                'logit_max_error': logit_error,
                'padding_mass': float(np.mean(padding)),
                'position_start': maxlen - len(items)}
