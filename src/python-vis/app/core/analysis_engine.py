"""Registry and execution boundary for behavioral and internal analyses."""
from dataclasses import asdict
from datetime import datetime, timezone
from hashlib import sha256
from importlib import import_module
import json
from app.analysis.base import AnalysisConfig
from app.core.analysis_data import AnalysisData, AnalysisPrerequisite
from app.core.artifact_store import ArtifactStore
from app.core.ranker import Ranker
from app.core.model_adapter import ModelNotReadyError


class AnalysisEngine:
    ALLOWED = {'h1', 'h2', 'h3'}

    def __init__(self, data, model):
        self.repository = data
        self.model = model
        self.data = AnalysisData(data)
        self.ranker = Ranker(model, self.data)
        self.store = ArtifactStore(data.settings.artifacts)

    def readiness(self, hypothesis=None):
        if hypothesis and hypothesis not in self.ALLOWED:
            raise ValueError('Unknown hypothesis')
        model_ready = self.model.status()['ready']
        data_ready = self.repository.available
        requires_metadata = hypothesis in {'h1', 'h2', 'h3'}
        metadata = self.repository.metadata.validation if data_ready else {
            'state': 'missing', 'message': 'Processed interaction dataset is missing'}
        metadata_ready = metadata['state'] == 'verified'
        missing = self.repository.metadata.missing_files if requires_metadata else []
        return {'ready': bool(model_ready and data_ready and
                              (metadata_ready or not requires_metadata)),
                'model_ready': model_ready, 'data_ready': data_ready,
                'metadata_ready': metadata_ready, 'hypothesis': hypothesis,
                'requires_metadata': requires_metadata,
                'metadata_state': metadata['state'],
                'metadata_message': metadata['message'],
                'missing_metadata_files': missing}

    def _analysis(self, hypothesis, phase):
        module = import_module(f'app.analysis.phase1.{hypothesis}')
        cls = getattr(module, f'{hypothesis.upper()}Analysis')
        base = cls(self.data, self.ranker)
        if phase == 1:
            return base
        from importlib import import_module as load_module
        inner = load_module(f'app.analysis.phase2.{hypothesis}')
        return getattr(inner, f'{hypothesis.upper()}Internal')(self.data, self.ranker, base)

    def run(self, hypothesis, phase, pair, values=None, progress=None):
        self._validate(hypothesis, phase, pair)
        if not self.model.status()['ready']:
            raise ModelNotReadyError('Load a locally trained checkpoint before running model analyses')
        if not self.repository.available:
            raise AnalysisPrerequisite('Missing processed SASRec interaction data')
        if hypothesis in {'h1', 'h2', 'h3'}:
            self.data.require_metadata()
        config = AnalysisConfig(**(values or {}))
        if not (1 <= config.max_users <= 300 and 2 <= config.top_k <= 60 and
                1 <= config.max_examples <= 30):
            raise ValueError('Invalid analysis settings')
        if config.history_window not in (0, 10, 20, 50) or config.attention_layer < 0 or config.attention_head < -1:
            raise ValueError('Invalid genre analysis settings')
        params = asdict(config)
        signature = {'revision': self.store.REVISION, 'hypothesis': hypothesis,
                     'phase': phase, 'pair': pair, 'model': self.model.checkpoint_sha256,
                     'data': self._data_stamp(), 'parameters': params}
        if hypothesis == 'h1':
            signature['analysis_revision'] = 'h1-attention-audit-v3'
            signature['metadata'] = self._metadata_stamp()
        if hypothesis == 'h3' and phase == 1:
            signature['analysis_revision'] = 'h3-demographic-genres-v1'
            signature['metadata'] = self._metadata_stamp()
        if hypothesis == 'h3' and phase == 2:
            signature['analysis_revision'] = 'h3-relative-representation-attention-v2'
            signature['metadata'] = self._metadata_stamp()
        run_id = sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()[:16]
        existing = self.results(hypothesis, phase, pair)
        if existing and existing['run_id'] == run_id and existing.get('current'):
            return existing
        analysis = self._analysis(hypothesis, phase)
        analysis.progress = progress
        result = analysis.run(config)
        result.update({'hypothesis': hypothesis, 'phase': phase, 'pair': pair,
                       'config': params, 'run_id': run_id, 'status': 'complete',
                       'created_at': datetime.now(timezone.utc).isoformat(),
                       'provenance': signature, 'current': True,
                       'measures': {'observations': result['n_records'],
                                    'saved_examples': len(result['examples'])}})
        self.store.save(hypothesis, phase, pair, result)
        return result

    def _metadata_stamp(self):
        meta = self.repository.metadata
        paths = [meta.mapping_folder / name for name in ('sas_to_original_items.txt', 'sas_to_original_users.txt')]
        paths += [self.repository.settings.raw_movielens / name for name in ('movies.dat', 'ratings.dat', 'users.dat')]
        return {path.name: [path.stat().st_size, path.stat().st_mtime_ns] if path.is_file() else None for path in paths}

    def _data_stamp(self):
        path = self.repository.settings.interactions
        stats = path.stat() if path.is_file() else None
        return {'size': stats.st_size, 'mtime_ns': stats.st_mtime_ns} if stats else {}

    def results(self, hypothesis, phase, pair):
        self._validate(hypothesis, phase, pair)
        result = self.store.load(hypothesis, phase, pair)
        if result is not None:
            origin = result.get('provenance', {})
            result['current'] = bool(self.model.status()['ready'] and
                                     origin.get('model') == self.model.checkpoint_sha256 and
                                     origin.get('data') == self._data_stamp() and
                                     origin.get('revision') == self.store.REVISION)
            if hypothesis == 'h1':
                result['current'] = result['current'] and origin.get('analysis_revision') == 'h1-attention-audit-v3' and origin.get('metadata') == self._metadata_stamp()
            if hypothesis == 'h3' and phase == 2:
                result['current'] = result['current'] and origin.get('analysis_revision') == 'h3-relative-representation-attention-v2' and origin.get('metadata') == self._metadata_stamp()
            if hypothesis == 'h3' and phase == 1:
                result['current'] = result['current'] and (origin.get('analysis_revision') == 'h3-demographic-genres-v1' or
                     result.get('migration', {}).get('method') == 'identifier-only-artifact-migration-v1') and origin.get('metadata') == self._metadata_stamp()
        return result

    def _validate(self, hypothesis, phase, pair):
        if hypothesis not in self.ALLOWED or phase not in (1, 2) or pair not in ('a', 'b'):
            raise ValueError('Invalid hypothesis, phase, or pair')
