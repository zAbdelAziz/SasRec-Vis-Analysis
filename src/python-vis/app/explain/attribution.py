"""Removal sensitivity (not a causal attention explanation)."""


class AttributionService:
    def __init__(self, ranker):
        self.ranker = ranker

    def deletion_effects(self, history, candidate, max_positions=18):
        """Score difference after removing a historical item; positions subsequently shift."""
        if len(history) <= 1:
            return {'candidate': candidate, 'effects': [], 'baseline_score': None}
        start = max(0, len(history)-max_positions)
        positions = list(range(start, len(history)))
        variants = [history] + [history[:index] + history[index+1:] for index in positions]
        scores = self.ranker.model.score_many(variants, [candidate])[:, 0]
        baseline = float(scores[0])
        effects = [{'position': index-len(history), 'item_id': int(history[index]),
                    'score_delta': baseline-float(score)}
                   for index, score in zip(positions, scores[1:])]
        return {'candidate': int(candidate), 'effects': effects, 'baseline_score': baseline,
                'limitation': 'Deleting an item also shifts sequence positions.'}
