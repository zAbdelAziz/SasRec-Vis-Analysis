"""Post-hoc genre reference vectors and uncertainty for learned SASRec states.

Genre centroids are NOT model parameters: they summarize verified item embeddings.
A movie's unit weight is split equally over its verified genres, as in Phase I.
"""
from hashlib import sha256
import numpy as np

from app.core.genre_analysis import genre_labels


def genre_reference_vectors(embeddings, item_genres):
    """Return normalized genre centroids and exposure support from item embeddings.

    Embedding row zero is reserved for padding and never included. Zero-norm
    embeddings are excluded. Raw model coordinates are never standardized on
    the demographic group being evaluated.
    """
    vectors = np.asarray(embeddings, dtype=np.float64)
    if vectors.ndim != 2 or not np.isfinite(vectors).all():
        raise ValueError('Item embeddings must be a finite two-dimensional matrix')
    labels = sorted({g for item, _ in item_genres.items() for g in genre_labels(item, item_genres)})
    sums = {genre: np.zeros(vectors.shape[1], dtype=np.float64) for genre in labels}
    mass = {genre: 0.0 for genre in labels}
    movies = {genre: 0 for genre in labels}
    for item in sorted(item_genres):
        if not 0 < item < len(vectors):
            raise ValueError(f'Genre metadata item {item} is outside the learned embedding table')
        genres = genre_labels(item, item_genres)
        norm = np.linalg.norm(vectors[item])
        if norm <= 1e-12:
            continue
        unit = vectors[item] / norm
        for genre in genres:
            weight = 1.0 / len(genres)
            sums[genre] += weight * unit
            mass[genre] += weight
            movies[genre] += 1
    centroids, support = {}, {}
    for genre in labels:
        magnitude = np.linalg.norm(sums[genre])
        if magnitude > 1e-12:
            centroids[genre] = sums[genre] / magnitude
        support[genre] = {'movies': movies[genre], 'fractional_mass': mass[genre],
                          'centroid_norm_before_normalizing': float(magnitude)}
    if not centroids:
        raise ValueError('No nonzero genre reference vectors could be constructed')
    return centroids, support


def user_genre_alignment(user_state, centroids):
    """Cosine to post-hoc genre references, centered by user across all genres."""
    state = np.asarray(user_state, dtype=np.float64)
    if state.ndim != 1 or not np.isfinite(state).all():
        raise ValueError('Contextual state must be a finite vector')
    norm = np.linalg.norm(state)
    if norm <= 1e-12:
        raise ValueError('Cannot compare a zero-norm contextual state')
    raw = {genre: float(np.dot(state / norm, centroid)) for genre, centroid in centroids.items()}
    baseline = float(np.mean(list(raw.values())))
    relative = {genre: value - baseline for genre, value in raw.items()}
    return {'cosine': raw, 'relative': relative, 'user_baseline': baseline}


def alignment_group_summaries(users, genres, seed=42, resamples=2000):
    """Deterministic per-cell percentile intervals, resampling users only."""
    from app.core.demographic_genres import AGE_LABELS, GENDERS
    groups = []
    for age in AGE_LABELS:
        for gender in GENDERS:
            cohort = [u for u in users if u['age_code'] == age and u['gender'] == gender]
            for genre in genres:
                values = np.array([u['relative_alignment'][genre] for u in cohort], dtype=np.float64)
                n = len(values)
                low = high = None
                if n > 1:
                    token = f'h3-alignment-v1:{seed}:{age}:{gender}:{genre}'
                    cell_seed = int.from_bytes(sha256(token.encode()).digest()[:8], 'little')
                    rng = np.random.default_rng(cell_seed)
                    resampled = values[rng.integers(n, size=(resamples, n))].mean(axis=1)
                    low, high = map(float, np.quantile(resampled, [.025, .975]))
                groups.append({'age_code': age, 'age_label': AGE_LABELS[age], 'gender': gender,
                               'genre': genre, 'n': n,
                               'mean': float(values.mean()) if n else None,
                               'median': float(np.median(values)) if n else None,
                               'ci_low': low, 'ci_high': high, 'sparse': n < 5})
    return groups
