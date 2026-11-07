"""Shared Phase II analyses and two complementary internal examination methods."""
from app.analysis.base import BaseAnalysis
from app.explain.attribution import AttributionService
from app.explain.representations import RepresentationExtractor


class BaseInternalAnalysis(BaseAnalysis):
    def __init__(self, data, ranker, phase1):
        super().__init__(data, ranker)
        self.phase1 = phase1
        self.reps = RepresentationExtractor(ranker.model)
        self.attributions = AttributionService(ranker)

    def prepare(self, config):
        self.phase1.progress = getattr(self, 'progress', None)
        return self.phase1.run(config)

    def attribution(self, history, rankings):
        if not history or not rankings:
            return {'effects': []}
        return self.attributions.deletion_effects(history, int(rankings[0]['item_id']))

    def finish(self, original, examples, views, methods):
        return {'records': original['records'], 'examples': examples,
                'views': views, 'methods': methods,
                'n_records': original['n_records'],
                'notes': original['notes'] + ['Internal diagnostics do not establish causal explanations by themselves.']}
