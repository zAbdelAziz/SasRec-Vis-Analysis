"""H2 Phase II: contextual-state alignment and item magnitude by release decade."""
import numpy as np
from app.analysis.phase2.base import BaseInternalAnalysis


class H2Internal(BaseInternalAnalysis):
    hypothesis = 'h2'

    def run(self, config):
        original = self.prepare(config)
        embeddings = self.ranker.model.require_ready().item_emb.weight.detach().cpu().numpy()
        years = self.data.release_years
        geometry = []
        for example in original['examples']:
            state = np.asarray(self.reps.snapshot(example['full_history'])['final'])
            # All unseen candidates, not just the selected top-K: avoid selection on high score.
            candidates = [item for item in self.ranker.candidates(self.data.history(example['user_id'])) if item in years]
            vectors = embeddings[candidates]
            norms = np.linalg.norm(vectors, axis=1)
            denominators = norms * np.linalg.norm(state)
            scores = vectors @ state
            cosines = np.divide(scores, denominators, out=np.zeros_like(scores), where=denominators > 0)
            decades = np.array([years[item] // 10 * 10 for item in candidates])
            for decade in sorted(set(decades.tolist())):
                mask = decades == decade
                geometry.append({'user_id': example['user_id'], 'decade': f'{decade}s',
                                 'candidate_count': int(mask.sum()),
                                 'mean_cosine': float(cosines[mask].mean()),
                                 'mean_score': float(scores[mask].mean()),
                                 'mean_embedding_norm': float(norms[mask].mean())})
        result = self.finish(original, original['examples'], {**original['views'], 'geometry': geometry},
                             original['methods'] + ['Final-state / candidate embedding cosine',
                                                    'Dot-product scores and embedding norms by decade'])
        result['notes'].append('Phase II covers saved cases and all known-year unseen candidates, grouped by decade. '
                               'SASRec ranks with state–item dot products, which depend on vector direction and magnitude. '
                               'Mean cosine, score and item norm are descriptive; they do not isolate a causal release-year effect. '
                               'The full model context is used regardless of the selected history reference.')
        return result
