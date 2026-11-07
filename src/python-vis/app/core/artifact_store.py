"""JSON artifacts tagged by checkpoint and analysis configuration."""
import json
from pathlib import Path


class ArtifactStore:
    REVISION = 'phase3-ui-fixes-2026-10-30'

    def __init__(self, folder):
        self.folder = Path(folder)

    def path(self, hypothesis, phase, pair):
        return self.folder / f'phase{phase}' / hypothesis / f'pair-{pair}' / 'summary.json'

    def load(self, hypothesis, phase, pair):
        path = self.path(hypothesis, phase, pair)
        if not path.is_file():
            return None
        return json.loads(path.read_text(encoding='utf-8'))

    def save(self, hypothesis, phase, pair, value):
        path = self.path(hypothesis, phase, pair)
        path.parent.mkdir(parents=True, exist_ok=True)
        intermediate = path.with_suffix('.tmp')
        intermediate.write_text(json.dumps(value, allow_nan=False, indent=2), encoding='utf-8')
        intermediate.replace(path)
        return path
