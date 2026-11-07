"""Common-candidate ranking. Full catalog is intentional for comparison analyses."""
import numpy as np
from app.core.metrics import Metrics


class Ranker:
    def __init__(self, model, data):
        self.model, self.data = model, data
        self.metrics = Metrics()

    def candidates(self, *histories):
        excluded = set(item for history in histories for item in history)
        return [item for item in range(1, self.data.repository.item_count + 1) if item not in excluded]

    @staticmethod
    def rank_scores(candidates, scores, top_k=20):
        order = np.argsort(-np.asarray(scores), kind='stable')[:min(top_k, len(candidates))]
        return [{'rank': i + 1, 'item_id': int(candidates[index]), 'score': float(scores[index])}
                for i, index in enumerate(order)]

    def rank(self, history, candidates, top_k=20):
        if not candidates:
            raise ValueError('No common eligible candidates')
        scores = self.model.score(list(history), list(candidates))
        return self.rank_scores(candidates, scores, top_k)

    def compare_variants(self, original, variants, top_k=20):
        """Shared candidate pool and batched scoring for controlled history edits."""
        if not variants:
            return []
        candidates = self.candidates(original, *variants)
        if not candidates:
            raise ValueError('No common eligible candidates')
        scores = self.model.score_many([original, *variants], candidates)
        before = self.rank_scores(candidates, scores[0], top_k)
        first_ids = self.ids(before)
        return [{'rank_change': self.metrics.rank_change(first_ids, self.ids(after)),
                 'ranking_before': before, 'ranking_after': after,
                 'common_candidates': len(candidates)}
                for after in (self.rank_scores(candidates, values, top_k) for values in scores[1:])]

    @staticmethod
    def ids(ranking):
        return [int(row['item_id']) for row in ranking]

    def compare(self, first, second, top_k=20):
        candidates = self.candidates(first, second)
        before = self.rank(first, candidates, top_k)
        after = self.rank(second, candidates, top_k)
        return {'rank_change': self.metrics.rank_change(self.ids(before), self.ids(after)),
                'ranking_before': before, 'ranking_after': after,
                'common_candidates': len(candidates)}

    def genre_exposure(self, history, genres, top_k=20):
        ranking = self.rank(history, self.candidates(history), top_k)
        return self.metrics.genre_profile(self.ids(ranking), genres), ranking
