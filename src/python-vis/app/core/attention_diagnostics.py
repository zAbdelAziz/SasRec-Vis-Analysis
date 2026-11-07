"""Support-aware diagnostics of contextual attention; never invent missing pairs."""
from collections import defaultdict
import numpy as np

REFERENCE_GENRES = ('Sci-Fi', 'Romance', 'Animation', 'Horror')


def nullable(values):
    """NaN internally, JSON null at the API boundary (JSON has no NaN)."""
    a = np.asarray(values, dtype=float)
    return np.where(np.isfinite(a), a, None).tolist()


def weighted_stats(values, weights, distances, users):
    values, weights = np.asarray(values), np.asarray(weights)
    if not len(values):
        return dict(mean=None, median=None, std=None, count=0, mass=0., users=0,
                    mean_distance=None, max_user_fraction=None)
    mass = weights.sum()
    mean = np.average(values, weights=weights)
    order = np.argsort(values, kind='stable')
    median = values[order[np.searchsorted(np.cumsum(weights[order]), mass / 2)]]
    user_ids, inverse = np.unique(users, return_inverse=True)
    by_user = np.bincount(inverse, weights=weights)
    return dict(mean=float(mean), median=float(median),
                std=float(np.sqrt(np.average((values - mean)**2, weights=weights))),
                count=len(values), mass=float(mass), users=len(user_ids),
                mean_distance=float(np.average(distances, weights=weights)),
                max_user_fraction=float(by_user.max()/mass))


def genre_statistics(snapshots, genres, labels):
    """Exact fractional weighted statistics, with and without self-pairs."""
    chunks = defaultdict(list)
    for snap in snapshots:
        items = snap['items']
        q, k = np.tril_indices(len(items))
        membership = np.array([[1/len(set(genres[item])) if g in genres[item] else 0
                                for g in labels] for item in items])
        values = snap['attention'][q, k]
        for i in range(len(labels)):
            for j in range(len(labels)):
                weights = membership[q, i] * membership[k, j]
                mask = weights > 0
                if mask.any():
                    chunks[i,j].append((values[mask], weights[mask], (q-k)[mask],
                                        np.full(mask.sum(), snap['user_id'])))
    records = []
    for i, query in enumerate(labels):
        for j, key in enumerate(labels):
            parts = chunks[i,j]
            arrays = [np.concatenate([p[c] for p in parts]) for c in range(4)] if parts else [np.array([])]*4
            values, weights, distance, users = arrays
            keep = distance > 0
            records.append(dict(query=query, key=key, **weighted_stats(*arrays),
                                nonself=weighted_stats(values[keep], weights[keep], distance[keep], users[keep]),
                                missing_reason=None if parts else 'No valid causal movie-pair observations in this sample/window'))
    return records


def distance_statistics(snapshots, genres):
    """Exact-distance comparisons plus matching within user and distance."""
    accum = defaultdict(lambda: [0., 0])
    matched, user_gaps = [], []
    for snap in snapshots:
        items, attention = snap['items'], snap['attention']
        numerator, support = 0., 0
        for d in range(1, len(items)):
            k = np.arange(len(items)-d)
            q = k+d
            overlap = np.array([bool(set(genres[items[i]]) & set(genres[items[j]])) for i,j in zip(q,k)])
            values = attention[q,k]
            means, counts = [], []
            for flag in (False, True):
                group = values[overlap == flag]
                accum[d,flag][0] += float(group.sum(dtype=np.float64))
                accum[d,flag][1] += len(group)
                means.append(float(group.mean()) if len(group) else None)
                counts.append(len(group))
            if min(counts):
                weight = min(counts)
                delta = means[1]-means[0]
                numerator += weight*delta
                support += weight
                matched.append(dict(user_id=snap['user_id'], distance=d, gap=delta, weight=weight,
                                    overlapping=means[1], disjoint=means[0]))
        if support:
            user_gaps.append(dict(user_id=snap['user_id'], gap=numerator/support, weight=support))
    curves = [dict(distance=d, overlap=flag, count=count, mean=total/count if count else None)
              for (d,flag),(total,count) in sorted(accum.items())]
    total_weight = sum(r['weight'] for r in matched)
    summary = dict(matched_strata=len(matched), matched_users=len(user_gaps), weight=total_weight,
                   gap=sum(r['gap']*r['weight'] for r in matched)/total_weight if total_weight else None,
                   equal_user_gap=float(np.mean([r['gap'] for r in user_gaps])) if user_gaps else None,
                   positive_users=sum(r['gap'] > 0 for r in user_gaps))
    return dict(curves=curves, matched=matched, user_gaps=user_gaps, summary=summary)


def movie_matrix(snapshots, genres, movies, seed, per_genre=12):
    """Sample observed movies, then aggregate only their real causal occurrences."""
    observed = sorted({i for s in snapshots for i in s['items']})
    rng = np.random.default_rng(seed)
    selected, boundaries = [], []
    # Each movie appears once, assigned to its first matching selected genre.
    for genre in REFERENCE_GENRES:
        pool = [i for i in observed if next((g for g in REFERENCE_GENRES if g in genres[i]), None) == genre]
        chosen = sorted(rng.choice(pool, min(per_genre, len(pool)), replace=False).tolist()) if pool else []
        boundaries.append(dict(genre=genre, start=len(selected), count=len(chosen), available=len(pool)))
        selected.extend(chosen)
    index = {item:i for i,item in enumerate(selected)}
    n = len(selected)
    sums, counts, users = np.zeros((n,n)), np.zeros((n,n), dtype=int), np.zeros((n,n), dtype=int)
    for snap in snapshots:
        seen = set()
        for q,item in enumerate(snap['items']):
            if item not in index:
                continue
            for k in range(q+1):
                key = snap['items'][k]
                if key in index:
                    i,j = index[item], index[key]
                    sums[i,j] += float(snap['attention'][q,k])
                    counts[i,j] += 1
                    seen.add((i,j))
        for i,j in seen:
            users[i,j] += 1
    mean = np.divide(sums, counts, out=np.full_like(sums,np.nan), where=counts>0)
    nonself = ~np.eye(n,dtype=bool)
    return dict(movies=[movies[i] for i in selected], groups=boundaries, mean=nullable(mean),
                counts=counts.tolist(), users=users.tolist(), supported=int((counts>0).sum()),
                total=n*n, off_diagonal_supported=int(((counts>0)&nonself).sum()),
                off_diagonal_total=int(nonself.sum()),
                scale_max=1.0)


def audit_diagnostics(snapshots, genres, labels, movies, seed):
    return dict(genre_statistics=genre_statistics(snapshots,genres,labels),
                distance=distance_statistics(snapshots,genres),
                movie_matrix=movie_matrix(snapshots,genres,movies,seed))

