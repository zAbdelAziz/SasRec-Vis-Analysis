"""Fractional genre metrics shared by the two H1 phases."""
import numpy as np
from app.core.attention_diagnostics import nullable


def genre_labels(item, genres):
    labels = sorted(set(genres.get(item, [])))
    if item <= 0 or not labels or any(not g.strip() or g in ('nan', '(no genres listed)') for g in labels):
        raise ValueError(f'Missing or invalid genres for item {item}')
    return labels


def profile(items, genres):
    result = {}
    for item in items:
        labels = genre_labels(item, genres)
        if not labels:
            raise ValueError(f'Missing genres for item {item}')
        for label in labels:
            result[label] = result.get(label, 0.) + 1 / len(labels) / len(items)
    if items and not np.isclose(sum(result.values()), 1):
        raise ValueError('Genre shares must sum to one')
    return result


def movie_lookup(data):
    meta = data.repository.metadata
    table = meta.item_map.merge(meta.movies, on='original_movie_id', validate='one_to_one')
    return {int(r.item_id): {'item_id': int(r.item_id), 'original_movie_id': int(r.original_movie_id), 'title': str(r.title),
                            'genres': sorted(set(str(r.genres).split('|')))} for r in table.itertuples()}


def aggregate_pairs(items, genres, attention, residual, labels):
    """Weighted mean; each causal movie pair allocates total mass 1 across cells."""
    for item in items:
        genre_labels(item, genres)
    membership = np.array([[1 / len(set(genres[i])) if g in genres[i] else 0
                            for g in labels] for i in items])
    valid = np.tril(np.ones(attention.shape))
    weights = membership.T @ valid @ membership
    counts = (membership > 0).astype(float).T @ valid @ (membership > 0)
    def mean(values):
        total = membership.T @ (values * valid) @ membership
        return np.divide(total, weights, out=np.full_like(total, np.nan), where=weights > 0)
    return {'raw': nullable(mean(attention)), 'adjusted': nullable(mean(residual)),
            'mass': weights.tolist(), 'counts': counts.astype(int).tolist()}
