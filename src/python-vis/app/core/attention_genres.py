"""H3 internal final-query attention by verified movie genre.

Never confuse attention assigned to a position with a causal explanation. Original
probabilities are kept intact: the uniform-exposure reference retains the
observed non-self mass, and self/padding are reported separately.
"""
from hashlib import sha256
import numpy as np

from app.core.demographic_genres import AGE_LABELS, GENDERS
from app.core.genre_analysis import genre_labels


def final_query_genre_attention(snapshot, item_genres, labels):
    """Aggregate the last query's attention to preceding real movies.

    Returns both raw probability mass and conditional-on-nonself shares. For
    the main metric, 'attention_excess' is observed raw genre mass minus the
    same non-self mass uniformly distributed across eligible past positions.
    The raw model attention is NEVER modified or silently re-normalized.
    """
    items = [int(x) for x in snapshot['items']]
    weights = np.asarray(snapshot['attention'], dtype=np.float64)
    n = len(items)
    if n < 2 or weights.shape != (n, n) or not np.isfinite(weights).all():
        raise ValueError('H3 attention needs at least two valid sequence positions')
    if np.any(weights < -1e-8) or np.any(weights[-1] < 0):
        raise ValueError('Attention weights must be nonnegative')
    padding = float(snapshot['row_padding_mass'][-1])
    if padding < -1e-7:
        raise ValueError('Negative padding attention mass')
    nonself = weights[-1, :-1].copy()
    self_mass = float(weights[-1, -1])
    nonself_mass = float(nonself.sum())
    if not np.isclose(nonself_mass + self_mass + padding, 1, atol=1e-5):
        raise ValueError('Final attention row must sum to one including self and padding')
    if nonself_mass <= 1e-12:
        raise ValueError('No non-self attention available to analyze')
    names = list(labels)
    lookup = {label: index for index, label in enumerate(names)}
    membership = np.zeros((n-1, len(names)), dtype=np.float64)
    for row, item in enumerate(items[:-1]):
        genres = genre_labels(item, item_genres)
        for genre in genres:
            if genre not in lookup:
                raise ValueError(f'Unknown movie genre: {genre}')
            membership[row, lookup[genre]] += 1.0 / len(genres)
    observed = nonself @ membership
    occurrence = membership.mean(axis=0)
    expected = nonself_mass * occurrence
    excess = observed - expected
    conditional = observed / nonself_mass
    if not np.isclose(observed.sum(), nonself_mass, atol=1e-7):
        raise ValueError('Fractional genre attribution lost attention mass')
    if not np.isclose(excess.sum(), 0, atol=1e-7):
        raise ValueError('Observed and expected genre exposure must balance')
    return {
        'items': items, 'nonself_weights': nonself, 'membership': membership,
        'attention_mass': {g: float(v) for g, v in zip(names, observed)},
        'expected_mass': {g: float(v) for g, v in zip(names, expected)},
        'attention_excess': {g: float(v) for g, v in zip(names, excess)},
        'historical_exposure': {g: float(v) for g, v in zip(names, occurrence)},
        'conditional_attention_share': {g: float(v) for g, v in zip(names, conditional)},
        'conditional_excess': {g: float(v/nonself_mass) for g, v in zip(names, excess)},
        'self_mass': self_mass, 'padding_mass': padding,
        'nonself_mass': nonself_mass, 'position_count': n-1,
        'row_normalization_error': float(abs(nonself_mass + self_mass + padding - 1)),
        # Each distance appears once in a final-position query.
        'by_lag': (nonself / nonself_mass)[::-1].copy(),
    }


def leave_one_user_out_position_excess(rows, labels):
    """Position-sensitive descriptive reference from *other* sampled users.

    Estimate each lag's conditional attention share across other users who
    have that lag. Normalize the supported lag weights to the target user's
    eligible history, and scale by its observed non-self mass. If a target
    lag has no other-user support, return None (do not invent a baseline).
    """
    if not rows:
        return []
    maxlag = max(len(row['by_lag']) for row in rows)
    sums = np.zeros(maxlag, dtype=float)
    counts = np.zeros(maxlag, dtype=int)
    for row in rows:
        values = row['by_lag']
        sums[:len(values)] += values
        counts[:len(values)] += 1
    results = []
    for row in rows:
        length = len(row['by_lag'])
        support = counts[:length] - 1
        if np.any(support < 1):
            results.append({'position_excess': None, 'position_expected_mass': None,
                            'position_reference_users_min': int(support.min()),
                            'position_reference_available': False})
            continue
        reference = (sums[:length] - row['by_lag']) / support
        denominator = reference.sum()
        if denominator <= 1e-12:
            results.append({'position_excess': None, 'position_expected_mass': None,
                            'position_reference_users_min': int(support.min()),
                            'position_reference_available': False})
            continue
        expected_by_key = (reference[::-1] / denominator) * row['nonself_mass']
        by_genre = expected_by_key @ row['membership']
        observed_by_genre = row['nonself_weights'] @ row['membership']
        difference = observed_by_genre - by_genre
        if not np.isclose(difference.sum(), 0, atol=1e-7):
            raise ValueError('Position-reference genre mass failed to balance')
        results.append({
            'position_excess': {g: float(value) for g, value in zip(labels, difference)},
            'position_expected_mass': {g: float(value) for g, value in zip(labels, by_genre)},
            'position_reference_users_min': int(support.min()),
            'position_reference_available': True,
        })
    return results


def attention_group_summaries(users, genres, metric='attention_excess', seed=42, resamples=2000):
    """One value per user per cell, with deterministic user-bootstrap intervals."""
    if metric not in {'attention_excess', 'position_excess', 'conditional_excess'}:
        raise ValueError('Unknown attention metric')
    if resamples < 20:
        raise ValueError('Bootstrap needs at least 20 resamples')
    groups = []
    for age in AGE_LABELS:
        for gender in GENDERS:
            all_in_group = [row for row in users if row['age_code'] == age and row['gender'] == gender]
            for genre in genres:
                vals = [row.get(metric, {}).get(genre) for row in all_in_group
                        if isinstance(row.get(metric), dict)]
                values = np.asarray([value for value in vals if value is not None], dtype=np.float64)
                if not np.isfinite(values).all():
                    raise ValueError('Non-finite user-level attention excess')
                n = len(values)
                low = high = None
                if n >= 2:
                    token = f'h3-attention-v2:{metric}:{seed}:{age}:{gender}:{genre}'
                    cell_seed = int.from_bytes(sha256(token.encode()).digest()[:8], 'little')
                    rng = np.random.default_rng(cell_seed)
                    means = values[rng.integers(n, size=(resamples, n))].mean(axis=1)
                    low, high = map(float, np.quantile(means, [.025, .975]))
                groups.append({'age_code': age, 'age_label': AGE_LABELS[age],
                               'gender': gender, 'genre': genre,
                               'n': n, 'group_users': len(all_in_group),
                               'mean': float(values.mean()) if n else None,
                               'median': float(np.median(values)) if n else None,
                               'ci_low': low, 'ci_high': high, 'sparse': n < 5})
    return groups


def snapshot_preview(snapshot, attention_row, movie_metadata, last=24):
    """Only persist movie-level attention for selected examples, not all users."""
    items = snapshot['items']
    keys = []
    for index in range(max(0, len(items)-1-last), len(items)-1):
        item = items[index]
        info = movie_metadata[item]  # Verified metadata; never invent a movie title.
        keys.append({**info, 'distance': len(items)-1-index,
                     'attention_weight': float(attention_row[index]),
                     'position': index+1})
    return keys
