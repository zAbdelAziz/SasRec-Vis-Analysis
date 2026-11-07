"""Read PyTorch SASRec states without editing the upstream source."""
import numpy as np
from app.core.metrics import Metrics


class RepresentationExtractor:
    def __init__(self, adapter):
        self.adapter = adapter
        self.metrics = Metrics()

    def snapshot(self, history, layers=False):
        import torch
        model = self.adapter.require_ready()
        if not history:
            raise ValueError('History must not be empty')
        maxlen = int(self.adapter.config['maxlen'])
        seq = np.zeros((1, maxlen), dtype=np.int64)
        trimmed = history[-maxlen:]
        seq[0, -len(trimmed):] = trimmed
        captured = []
        hooks = []
        if layers:
            # Pointwise FFN layers exist in the original pmixer SASRec implementation.
            for layer in getattr(model, 'forward_layers', []):
                def collect(_layer, _input, output):
                    captured.append(output.detach().cpu().numpy())
                hooks.append(layer.register_forward_hook(collect))
        try:
            with torch.inference_mode():
                # Do not pass a torch.Tensor: upstream log2feats() uses NumPy for
                # position IDs and multiplies those IDs by the input mask.
                states = model.log2feats(seq)
                final = states[0, -1].detach().cpu().numpy()
        finally:
            for hook in hooks:
                hook.remove()
        layer_vectors = []
        for item in captured:
            # FFN shapes may be batch/seq/hidden or a different block-specific format.
            if item.ndim == 3 and item.shape[-1] == len(final):
                layer_vectors.append(item[0, -1].tolist())
        return {'final': final.tolist(), 'layers': layer_vectors}

    def compare(self, first, second):
        a = self.snapshot(first, True)
        b = self.snapshot(second, True)
        return {'final_cosine': self.metrics.cosine(a['final'], b['final']),
                'layer_cosines': [self.metrics.cosine(x, y) for x, y in zip(a['layers'], b['layers'])],
                'first': a, 'second': b}

    def item_geometry(self, historical_ids, candidate_ids):
        embeddings = self.adapter.require_ready().item_emb.weight.detach().cpu().numpy()
        valid = [item for item in candidate_ids if 0 < item < len(embeddings)]
        if not valid:
            return {'historical_relationships': []}
        reference = np.mean(embeddings[valid], axis=0)
        return {'historical_relationships': [
            {'position': i-len(historical_ids), 'item_id': int(item),
             'mean_candidate_cosine': self.metrics.cosine(embeddings[item], reference)}
            for i, item in enumerate(historical_ids[-24:], start=max(0, len(historical_ids)-24))
            if 0 < item < len(embeddings)]}
