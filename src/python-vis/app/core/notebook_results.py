"""Read-only access to the original AI-pair Phase I notebook and its exports.

The research directory is never modified. No old `pair-b` JSON artifacts are
mistaken for notebook results. Large tables are returned only in pages.
"""
import csv
from collections import defaultdict
from datetime import datetime, timezone
from functools import lru_cache
import json
import math
from pathlib import Path
import re


TABLES = {
    'genre_share_summary', 'user_genre_profiles', 'demographic_genre_summary',
    'release_year_user_profiles', 'user_summary', 'top20_recommendations',
    'item_exposure_counts', 'user_popularity_exposure',
    'popularity_history_to_recommendation_summary',
    'q5_user_level_shift_summary', 'popularity_by_history_genre_diversity',
    'tie_order_sensitivity_users', 'tie_order_sensitivity_summary',
    'sensitivity_by_latest_tie_size', 'visible_latest_timestamp_tie_size',
    'tie_order_sensitive_examples', 'sampled_negative_test_sanity',
    'sampled_test_hit_by_target_popularity',
}
CATEGORIES = {'genre', 'gender', 'title', 'genres', 'popularity_quintile',
              'genre_mix_band', 'tie_group_band', 'latest_tie_band'}
INT_RE = re.compile(r'^-?\d+$')
FLOAT_RE = re.compile(r'^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$')


def _decode(key: str, value: str):
    if value == '' or value.lower() in ('nan', 'null'):
        return None
    if key not in CATEGORIES:
        if INT_RE.fullmatch(value):
            return int(value)
        if FLOAT_RE.fullmatch(value):
            parsed = float(value)
            return parsed if math.isfinite(parsed) else None
    return value


class NotebookResearch:
    def __init__(self, project_root: Path, *, run_id: str | None = None):
        self.project_root = Path(project_root)
        self.folder = self.project_root / 'research/phase1/ai_pair'
        self.run_id = run_id
        if run_id is not None:
            if not re.fullmatch(r'[0-9a-f]{16}', run_id):
                raise ValueError('Invalid generated run ID')
            self.outputs = self.project_root / 'src/data/artifacts/research/phase1/pair-b/runs' / run_id
        else:
            self.outputs = self.folder / 'outputs' 

    @property
    def available(self) -> bool:
        required = ('phase1_behavior_analysis.ipynb', 'AI_interaction_record_phase1.md')
        return all((self.folder / name).is_file() for name in required) and all(
            (self.outputs / f'{name}.csv').is_file() for name in TABLES) and (
            self.outputs / 'phase1_run_metadata.json').is_file()

    @lru_cache(maxsize=1)
    def metadata(self) -> dict:
        return json.loads((self.outputs / 'phase1_run_metadata.json').read_text(encoding='utf-8'))

    def notebook_cells(self) -> list[dict]:
        data = json.loads((self.folder / 'phase1_behavior_analysis.ipynb').read_text(encoding='utf-8'))
        return [{'index': index, 'markdown': ''.join(cell['source'])}
                for index, cell in enumerate(data['cells']) if cell['cell_type'] == 'markdown']

    def prompts(self) -> str:
        return (self.folder / 'AI_interaction_record_phase1.md').read_bytes().decode('utf-8')

    def table(self, name: str, *, offset: int = 0, limit: int = 100,
              user_id: int | None = None, genre: str | None = None) -> dict:
        if name not in TABLES:
            raise ValueError('Unknown research table')
        if not 0 <= offset or not 1 <= limit <= 500:
            raise ValueError('Use offset >= 0 and 1 <= limit <= 500')
        path = self.outputs / f'{name}.csv'
        if not path.is_file():
            raise FileNotFoundError(f'Missing original research table: {name}')
        records = []
        total = 0
        with path.open(newline='', encoding='utf-8') as handle:
            reader = csv.DictReader(handle)
            columns = list(reader.fieldnames or [])
            if user_id is not None and 'user_id' not in columns:
                raise ValueError('This table has no user_id field')
            if genre is not None and 'genre' not in columns:
                raise ValueError('This table has no genre field')
            for row in reader:
                if user_id is not None and row['user_id'] != str(user_id):
                    continue
                if genre is not None and row['genre'] != genre:
                    continue
                if offset <= total < offset + limit:
                    records.append({column: _decode(column, row[column]) for column in columns})
                total += 1
        return {'table': name, 'columns': columns, 'total': total, 'offset': offset,
                'limit': limit, 'rows': records, 'source': 'generated application run' if self.run_id else 'research/phase1/ai_pair/outputs'}

    def _all(self, name: str) -> list[dict]:
        # Aggregate research tables are small; never load the >100k-row tables here.
        if name not in {'genre_share_summary', 'popularity_history_to_recommendation_summary',
                        'q5_user_level_shift_summary', 'popularity_by_history_genre_diversity',
                        'tie_order_sensitivity_summary', 'sensitivity_by_latest_tie_size',
                        'demographic_genre_summary', 'sampled_test_hit_by_target_popularity'}:
            raise ValueError('Not an aggregate table')
        return self.table(name, limit=500)['rows']

    def result(self, hypothesis: str) -> dict:
        if hypothesis not in ('h1', 'h4', 'h5'):
            raise ValueError('Not a notebook-backed hypothesis')
        if not self.available:
            raise FileNotFoundError('Notebook source or original CSV exports are missing')
        views = {'notebook_source': True}
        if hypothesis == 'h1':
            views['genre_share'] = self._all('genre_share_summary')
        elif hypothesis == 'h4':
            views['popularity_profile'] = self._all('popularity_history_to_recommendation_summary')
            views['q5_shift'] = self._all('q5_user_level_shift_summary')
            views['genre_diversity'] = self._all('popularity_by_history_genre_diversity')
        else:
            views['tie_sensitivity'] = self._all('tie_order_sensitivity_summary')
            views['latest_tie_size'] = self._all('sensitivity_by_latest_tie_size')
        metadata = self.metadata()
        if hypothesis == 'h4':
            views['q5_hex_bins'] = self.q5_hex_bins()
        if hypothesis == 'h5':
            views['sensitive_users'] = self.sensitive_example_users()
        return {
            'hypothesis': hypothesis, 'phase': 1, 'pair': 'b', 'status': 'complete',
            'current': True, 'n_records': int(metadata['users']),
            'run_id': self.run_id or ('notebook-' + metadata['checkpoint_sha256'][:12]),
            'created_at': datetime.fromtimestamp(
                (self.outputs / 'phase1_run_metadata.json').stat().st_mtime,
                tz=timezone.utc).isoformat(),
            'config': {'history_window': 20, 'max_users': int(metadata['users']),
                       'top_k': int(metadata['top_k']), 'max_examples': 12, 'seed': 42},
            'methods': [], 'notes': [], 'records': [], 'views': views, 'examples': [],
            'measures': {'observations': int(metadata['users']), 'saved_examples': 0},
            'provenance': {'research_source': 'research/phase1/ai_pair/phase1_behavior_analysis.ipynb',
                           'checkpoint_sha256': metadata['checkpoint_sha256'],
                           'cohort': 'full eligible MovieLens-1M population',
                           'source_kind': 'generated notebook-equivalent run' if self.run_id else 'original notebook CSV exports',
                           'generated_run_id': self.run_id},
        }


    @lru_cache(maxsize=1)
    def q5_hex_bins(self) -> list[dict]:
        """Use the original notebook's Matplotlib gridsize=30 hexbin partition.

        Counts (not the log-normalized colors) are returned; the UI applies log
        coloring. No source CSV or PNG is modified.
        """
        import numpy as np
        from matplotlib.figure import Figure
        rows = []
        with (self.outputs / 'user_popularity_exposure.csv').open(newline='', encoding='utf-8') as handle:
            for row in csv.DictReader(handle):
                if row['popularity_quintile'] == 'Q5 popular':
                    rows.append((int(row['user_id']), float(row['latest20_history_share']),
                                 float(row['recommendation_exposure_share'])))
        if not rows:
            return []
        points = np.asarray(rows, dtype=float)
        fig = Figure()
        ax = fig.subplots()
        collection = ax.hexbin(points[:, 1], points[:, 2], gridsize=30,
                               mincnt=1, bins='log', linewidths=0.15)
        offsets = collection.get_offsets()
        counts = collection.get_array()
        # The nearest user is a navigational example, not a claim that the
        # selected user is the only observation contributing to this hexagon.
        result = []
        for (x, y), count in zip(offsets, counts):
            nearest = int(np.argmin((points[:, 1] - x)**2 + (points[:, 2] - y)**2))
            result.append({'history_q5_share': float(x), 'recommendation_q5_share': float(y),
                           'users': int(count), 'example_user_id': int(points[nearest, 0])})
        fig.clear()
        return result

    @lru_cache(maxsize=1)
    def sensitive_example_users(self) -> list[dict]:
        users = {}
        with (self.outputs / 'tie_order_sensitive_examples.csv').open(newline='', encoding='utf-8') as handle:
            for row in csv.DictReader(handle):
                user = int(row['user_id'])
                if user not in users:
                    users[user] = {'user_id': user, 'rbo_dissimilarity': float(row['rbo_dissimilarity']),
                                   'visible_tie_groups': int(row['visible_tie_groups'])}
        return list(users.values())

    def user_detail(self, hypothesis: str, user_id: int) -> dict:
        if hypothesis not in ('h1', 'h4', 'h5') or not 1 <= user_id <= int(self.metadata()['users']):
            raise ValueError('Unknown research hypothesis or user ID')
        records = {}
        tables = {'h1': ['user_genre_profiles', 'top20_recommendations'],
                  'h4': ['user_popularity_exposure', 'top20_recommendations'],
                  'h5': ['tie_order_sensitivity_users', 'tie_order_sensitive_examples']}
        for name in tables[hypothesis]:
            # Only 18, 20 or <=40 rows per user. The original files are read-only.
            records[name] = self.table(name, user_id=user_id, limit=100)['rows']
        return {'hypothesis': hypothesis, 'user_id': user_id, 'tables': records,
                'source': 'generated run' if self.run_id else 'original notebook exports',
                'has_detailed_example': bool(records.get('tie_order_sensitive_examples'))}

    def audit(self, hypothesis: str) -> dict:
        """Recalculate representative notebook statistics from immutable saved rows.

        The full checkpoint re-execution is a separate integration Phase 2 task.
        """
        from app.core.notebook_phase1 import bootstrap_mean_ci
        if hypothesis not in ('h1', 'h4', 'h5'):
            raise ValueError('Not a notebook-backed hypothesis')
        checks: dict[str, bool] = {}
        tolerance = 1e-9
        if hypothesis == 'h1':
            sums = defaultdict(float)
            counts = defaultdict(int)
            comedy = []
            with (self.outputs / 'user_genre_profiles.csv').open(encoding='utf-8', newline='') as handle:
                for row in csv.DictReader(handle):
                    delta = float(row['delta_recommendation_minus_history'])
                    genre = row['genre']
                    sums[genre] += delta
                    counts[genre] += 1
                    if genre == 'Comedy':
                        comedy.append(delta)
            checks['genre_count_18'] = len(counts) == 18
            checks['6040_users_per_genre'] = all(n == 6040 for n in counts.values())
            original = {row['genre']: row for row in self._all('genre_share_summary')}
            checks['genre_mean_deltas'] = all(
                abs(sums[g] / counts[g] - original[g]['delta_mean']) < tolerance
                for g in counts)
            lo, hi = bootstrap_mean_ci(comedy, seed=1000 + sorted(counts).index('Comedy'))
            checks['comedy_bootstrap_interval'] = (
                abs(lo - original['Comedy']['delta_ci_low']) < tolerance and
                abs(hi - original['Comedy']['delta_ci_high']) < tolerance)
        elif hypothesis == 'h4':
            q5 = []
            with (self.outputs / 'user_popularity_exposure.csv').open(encoding='utf-8', newline='') as handle:
                for row in csv.DictReader(handle):
                    if row['popularity_quintile'] == 'Q5 popular':
                        q5.append((float(row['latest20_history_share']),
                                   float(row['recommendation_exposure_share'])))
            shift = [r - h for h, r in q5]
            saved = self._all('q5_user_level_shift_summary')[0]
            checks['q5_user_count'] = len(shift) == saved['users'] == 6040
            checks['q5_mean_shift'] = abs(sum(shift) / len(shift) - saved['mean_recommendation_minus_history_q5_share']) < tolerance
            checks['q5_direction_counts'] = (
                sum(d > 1e-12 for d in shift) == saved['recommendation_q5_share_higher'] and
                sum(d < -1e-12 for d in shift) == saved['recommendation_q5_share_lower'])
            lo, hi = bootstrap_mean_ci(shift, seed=8410, draws=5000)
            checks['q5_bootstrap_interval'] = (
                abs(lo - saved['mean_shift_ci_low']) < tolerance and
                abs(hi - saved['mean_shift_ci_high']) < tolerance)
        else:
            n = 0
            changed = 0
            means = defaultdict(float)
            counts = defaultdict(int)
            with (self.outputs / 'tie_order_sensitivity_users.csv').open(encoding='utf-8', newline='') as handle:
                for row in csv.DictReader(handle):
                    n += 1
                    changed += int(row['top20_set_changed'])
                    band = row['tie_group_band']
                    means[band] += float(row['rbo_dissimilarity'])
                    counts[band] += 1
            checks['6040_tie_users'] = n == 6040
            checks['4320_top20_changes'] = changed == 4320
            checks['tie_band_means'] = all(
                counts.get(row['tie_group_band'], 0) == row['users'] and
                (row['users'] == 0 or abs(means[row['tie_group_band']] / row['users'] - row['mean_rbo_dissimilarity']) < tolerance)
                for row in self._all('tie_order_sensitivity_summary'))
        return {'hypothesis': hypothesis, 'ok': all(checks.values()),
                'checks': {key: bool(value) for key, value in checks.items()},
                'source': 'original notebook CSV exports', 'full_model_rerun': False}

    def manifest(self) -> dict:
        if not self.available:
            return {'available': False, 'message': 'Original notebook or one or more CSV exports missing'}
        summary = {
            'available': True, 'source': 'research/phase1/ai_pair',
            'metadata': self.metadata(), 'tables': sorted(TABLES),
            'figures': sorted(p.name for p in self.outputs.glob('*.png')),
            'note_cells': [cell['index'] for cell in self.notebook_cells()],
            'prompts': 'AI_interaction_record_phase1.md',
            'hypotheses': ['h1', 'h4', 'h5'],
        }
        with (self.outputs / 'visible_latest_timestamp_tie_size.csv').open(encoding='utf-8', newline='') as file:
            columns = next(csv.reader(file))
        expected = {'user_id', 'visible_latest_timestamp_tie_size',
                    'visible_tie_groups', 'train_history_length'}
        if set(columns) != expected:
            summary['schema_warnings'] = [
                'visible_latest_timestamp_tie_size.csv has columns different from the current notebook export statement; original file preserved.'
            ]
        return summary
