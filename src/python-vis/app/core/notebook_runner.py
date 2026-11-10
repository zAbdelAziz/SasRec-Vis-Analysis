"""Full-cohort notebook-compatible execution in versioned application artifacts.

The original notebook remains immutable. We execute its *original local code cells*
for the trained-model run, supplying only the initial Jupyter variables and a
DIFFERENT OUT_DIR. A run never overwrites research/ or existing Pair A artifacts.
Only a trusted, fixed notebook path is executable; no user-supplied code is run.
"""
from argparse import Namespace
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from uuid import uuid4

from app.core.notebook_figures import original_cells

RUN_CELLS = (3, 5, 7, 9, 11, 13, 15, 16, 18, 19, 20, 21, 22, 24, 26)


class NotebookPipeline:
    def __init__(self, project_root: Path):
        self.root = Path(project_root)
        self.folder = self.root / 'research/phase1/ai_pair'
        self.upstream = self.root / 'src/model/SASRec.pytorch/python'
        self.runs = self.root / 'src/data/artifacts/research/phase1/pair-b/runs'

    def missing_prerequisites(self) -> list[str]:
        files = [self.folder / 'phase1_behavior_analysis.ipynb',
                 self.root / 'artifacts/checkpoints/SASREC_CHECKPOINT.pth',
                 self.root / 'artifacts/checkpoints/args.txt',
                 self.upstream / 'model.py', self.upstream / 'data/ml-1m.txt',
                 *[self.root / 'src/data/raw/ml-1m' / name for name in ('ratings.dat','movies.dat','users.dat')],
                 *[self.root / 'src/data/mapping-source' / name for name in ('sas_to_original_users.txt','sas_to_original_items.txt')]]
        return [str(path.relative_to(self.root)) for path in files if not path.is_file()]

    def readiness(self) -> dict:
        missing = self.missing_prerequisites()
        return {'ready': not missing, 'missing_files': missing,
                'cohort': 'all 6040 eligible users', 'top_k': 20, 'maxlen': 200,
                'mode': 'full notebook execution; original research outputs are immutable'}

    def run(self, progress=None) -> dict:
        missing = self.missing_prerequisites()
        if missing:
            raise FileNotFoundError('Cannot rerun the original notebook without: ' + ', '.join(missing))
        import numpy as np
        import pandas as pd
        import matplotlib
        matplotlib.use('Agg', force=True)
        import matplotlib.pyplot as plt
        import torch

        source_path = self.folder / 'phase1_behavior_analysis.ipynb'
        source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
        checkpoint = self.root / 'artifacts/checkpoints/SASREC_CHECKPOINT.pth'
        checkpoint_hash = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        original_meta = json.loads((self.folder / 'outputs/phase1_run_metadata.json').read_text())
        if checkpoint_hash != original_meta['checkpoint_sha256']:
            raise ValueError('Checkpoint differs from the notebook reference; refusing to label this as an equivalent run')
        sys.path.insert(0, str(self.upstream))
        try:
            from model import SASRec
            run_id = hashlib.sha256(f'{time.time_ns()}-{uuid4().hex}'.encode()).hexdigest()[:16]
            self.runs.mkdir(parents=True, exist_ok=True)
            scratch = Path(tempfile.mkdtemp(prefix='.notebook-', dir=self.runs))
            np.random.seed(42)
            torch.set_num_threads(min(2, os.cpu_count() or 1))
            env = {'__builtins__': __builtins__, 'Path': Path, 'Namespace': Namespace,
                   'Counter': Counter, 'hashlib': hashlib, 'json': json, 'os': os,
                   're': re, 'sys': sys, 'time': time, 'np': np, 'pd': pd,
                   'plt': plt, 'torch': torch, 'SASRec': SASRec,
                   'DATA_FILE': self.upstream / 'data/ml-1m.txt',
                   'CHECKPOINT': checkpoint, 'ARGS_FILE': checkpoint.parent / 'args.txt',
                   'RAW_DIR': self.root / 'src/data/raw/ml-1m',
                   'MAP_DIR': self.root / 'src/data/mapping-source',
                   'OUT_DIR': scratch, 'MAXLEN': 200, 'TOP_K': 20,
                   'N_NEGATIVES': 100, 'BOOTSTRAP_DRAWS': 1000,
                   'display': lambda *_: None}
            cells = original_cells(self.folder)
            try:
                for number, index in enumerate(RUN_CELLS, 1):
                    if progress:
                        progress(number - 1, len(RUN_CELLS), f'Notebook cell {index} / {len(RUN_CELLS)}')
                    exec(compile(cells[index], f'original-notebook-cell-{index}', 'exec'), env)
                generated_metadata = json.loads((scratch / 'phase1_run_metadata.json').read_text())
                if generated_metadata['users'] != original_meta['users'] or generated_metadata['items'] != original_meta['items']:
                    raise ValueError('Generated run has incompatible cohort or catalog dimensions')
                (scratch / 'app_run_provenance.json').write_text(json.dumps({
                    'run_id': run_id, 'source_notebook_sha256': source_hash,
                    'checkpoint_sha256': checkpoint_hash,
                    'generated_at': datetime.now(timezone.utc).isoformat(),
                    'method': 'executed unchanged original notebook code cells',
                    'cells': list(RUN_CELLS), 'original_research_modified': False,
                }, indent=2), encoding='utf-8')
                scratch.rename(self.runs / run_id)
                if progress: progress(len(RUN_CELLS), len(RUN_CELLS), 'Generated Pair B artifacts saved separately')
                return {'run_id': run_id}
            finally:
                plt.close('all')
                if scratch.exists():
                    shutil.rmtree(scratch)
        finally:
            sys.path.remove(str(self.upstream))
