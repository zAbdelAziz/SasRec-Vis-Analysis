"""One small common interface for all research computations."""
from dataclasses import dataclass


@dataclass(frozen=True)
class AnalysisConfig:
    max_users: int = 40
    top_k: int = 20
    max_examples: int = 8
    seed: int = 42
    history_window: int = 20
    attention_layer: int = 0
    attention_head: int = -1


class BaseAnalysis:
    hypothesis = ''
    methods = []
    requires_metadata = False

    def __init__(self, data, ranker):
        self.data, self.ranker = data, ranker
        self.metrics = data.metrics

    def run(self, config: AnalysisConfig):
        raise NotImplementedError

    def output(self, records, examples, views, notes=()):
        return {'records': records, 'examples': examples, 'views': views, 'methods': self.methods, 'n_records': len(records), 'notes': list(notes)}
