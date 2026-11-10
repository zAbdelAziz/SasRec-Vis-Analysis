"""Reproduce notebook Matplotlib figures from its immutable exported CSVs.

The plotting statements execute verbatim from the *trusted local notebook* in a
new namespace; OUT_DIR points to a separate verification directory. This never
executes its inference cells or writes to research/.
"""
import json
from pathlib import Path


FIGURE_CELLS = (15, 16, 18, 19, 20, 21, 24)
FIGURE_NAMES = (
    'genre_share_change.png', 'recommendation_popularity_profile.png',
    'q5_user_input_output_density.png', 'sampled_test_hit_by_target_popularity.png',
    'same_second_order_sensitivity.png', 'release_year_profiles.png',
    'popularity_by_history_genre_diversity.png', 'sensitivity_by_latest_tie_size.png',
)


def original_cells(folder: Path) -> list[str]:
    notebook = json.loads((folder / 'phase1_behavior_analysis.ipynb').read_text(encoding='utf-8'))
    return [''.join(cell['source']) for cell in notebook['cells']]


def reproduce_figures(research_folder: Path, output: Path) -> dict:
    """Run the notebook's original figure cells on its original saved data."""
    import matplotlib
    matplotlib.use('Agg', force=True)
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    from app.core.notebook_phase1 import bootstrap_mean_ci

    research_folder = Path(research_folder)
    source = research_folder / 'outputs'
    output = Path(output)
    if source.resolve() == output.resolve() or source.resolve() in output.resolve().parents:
        raise ValueError('The verification directory must not be inside the original research outputs')
    output.mkdir(parents=True, exist_ok=True)
    def csv(name):
        return pd.read_csv(source / f'{name}.csv')

    env = {'__builtins__': __builtins__, 'pd': pd, 'np': np, 'plt': plt, 'OUT_DIR': output,
           'display': lambda *_: None, 'bootstrap_mean_ci': bootstrap_mean_ci,
           'all_genres': sorted(csv('genre_share_summary')['genre'].tolist()),
           'genre_summary': csv('genre_share_summary'),
           'popularity_profiles': csv('user_popularity_exposure'),
           'popularity_labels': ['Q1 rare', 'Q2', 'Q3', 'Q4', 'Q5 popular'],
           'test_results': csv('sampled_negative_test_sanity'),
           'sensitivity_summary': csv('tie_order_sensitivity_summary'),
           'release_summary_users': csv('release_year_user_profiles'),
           'user_summary': csv('user_summary'),
           'sensitivity': csv('tie_order_sensitivity_users'),
           'profiles': csv('user_genre_profiles')}
    for index in FIGURE_CELLS:
        source_code = original_cells(research_folder)[index]
        exec(compile(source_code, f'original-notebook-cell-{index}', 'exec'), env)
    plt.close('all')
    missing = [name for name in FIGURE_NAMES if not (output / name).is_file()]
    if missing:
        raise RuntimeError(f'Notebook plotting cells did not generate: {missing}')
    # Recomputed aggregate values must agree with the source to machine precision.
    checks = {}
    difference_details = {}
    for name, numeric_columns in {
        'popularity_history_to_recommendation_summary': ['latest20_history_share', 'unseen_catalog_share', 'recommendation_exposure_share'],
        'q5_user_level_shift_summary': ['mean_recommendation_minus_history_q5_share', 'mean_shift_ci_low', 'mean_shift_ci_high'],
        'popularity_by_history_genre_diversity': ['mean_effective_genres', 'mean_q5_exposure_gap', 'gap_ci_low', 'gap_ci_high'],
        'sensitivity_by_latest_tie_size': ['mean_rbo_dissimilarity', 'rbo_ci_low', 'rbo_ci_high'],
    }.items():
        expected = pd.read_csv(source / f'{name}.csv')
        actual = pd.read_csv(output / f'{name}.csv')
        if len(expected) != len(actual):
            difference_details[name] = {'original_rows': len(expected), 'reproduced_rows': len(actual)}
            checks[name] = False
            continue
        diffs = {column: float(np.nanmax(np.abs(
            expected[column].to_numpy(dtype=float) - actual[column].to_numpy(dtype=float))))
                 for column in numeric_columns}
        checks[name] = all(np.allclose(expected[column].to_numpy(dtype=float),
                                         actual[column].to_numpy(dtype=float),
                                         rtol=1e-8, atol=1e-9, equal_nan=True)
                           for column in numeric_columns)
        if not checks[name]:
            difference_details[name] = {'original_rows': len(expected),
                                        'reproduced_rows': len(actual),
                                        'max_abs_column_difference': diffs}
    result = {'source': 'verbatim plotting cells from original research notebook',
              'original_research_modified': False, 'figures': list(FIGURE_NAMES),
              'numeric_checks': checks, 'differences': difference_details, 'ok': all(checks.values())}
    (output / 'figure_validation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    # Differences remain visible; original exports are never overwritten to hide
    # notebook execution-order or floating-point discrepancies.
    return result
