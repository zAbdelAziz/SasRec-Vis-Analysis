"""Reusable functions extracted from research/phase1/ai_pair/phase1_behavior_analysis.ipynb.

The notebook remains the immutable reference. These functions retain its numerical
conventions and expose them independently of Jupyter global state. Full-cohort
recomputation and figure generation are wired into API jobs in integration Phase 2.
"""
import numpy as np


def left_pad(histories, maxlen):
    batch = np.zeros((len(histories), maxlen), dtype=np.int32)
    for i, history in enumerate(histories):
        visible = list(history)[-maxlen:]
        if visible:
            batch[i, -len(visible):] = visible
    return batch


def score_histories(model, user_ids, histories, item_ids, maxlen, batch_size=64):
    """Notebook cell 9; maxlen replaces the notebook's global MAXLEN."""
    import torch
    outputs = []
    for start in range(0, len(histories), batch_size):
        end = min(start + batch_size, len(histories))
        seq_batch = left_pad(histories[start:end], maxlen)
        with torch.no_grad():
            logits = model.predict(
                np.asarray(user_ids[start:end], dtype=np.int64),
                seq_batch,
                np.asarray(item_ids, dtype=np.int32),
            )
        outputs.append(logits.detach().cpu().numpy().astype(np.float32))
    return np.concatenate(outputs, axis=0)


def topk_excluding_seen(score_matrix, histories, k):
    result = np.empty((len(histories), k), dtype=np.int32)
    for row, history in enumerate(histories):
        scores = score_matrix[row].copy()
        if history:
            scores[np.asarray(sorted(set(history)), dtype=np.int32) - 1] = -np.inf
        order = np.argsort(-scores, kind='mergesort')[:k]
        result[row] = order + 1
    return result


def genre_profile(item_ids, genre_matrix):
    """Fractional multi-label profile from notebook cell 11."""
    if not item_ids:
        return np.zeros(genre_matrix.shape[1], dtype=np.float64)
    return genre_matrix[np.asarray(item_ids, dtype=np.int32) - 1].mean(axis=0).astype(np.float64)


def popularity_quintiles(train_popularity):
    """Five equal-sized *movie-rank* groups, not interaction-count quantiles."""
    n_items = len(train_popularity)
    candidate_ids = np.arange(1, n_items + 1, dtype=np.int32)
    popularity_order = np.lexsort((candidate_ids, -np.asarray(train_popularity)))
    popularity_quintile = np.empty(n_items, dtype=np.int32)
    for rank, item_index in enumerate(popularity_order):
        popularity_quintile[item_index] = 4 - min(4, (rank * 5) // n_items)
    return popularity_quintile


def reverse_visible_ties(visible_items, visible_times):
    """Exactly the block-reversal rule in notebook cell 5; return diagnostics."""
    if len(visible_items) != len(visible_times):
        raise ValueError('Items and timestamps must have the same length')
    perturbed = list(visible_items)
    start = 0
    user_tie_groups = 0
    user_tied_events = 0
    while start < len(visible_times):
        end = start + 1
        while end < len(visible_times) and visible_times[end] == visible_times[start]:
            end += 1
        if end - start > 1:
            perturbed[start:end] = reversed(perturbed[start:end])
            user_tie_groups += 1
            user_tied_events += end - start
        start = end
    latest_block_size = 0
    if visible_times:
        latest_block_size = 1
        while latest_block_size < len(visible_times) and visible_times[-latest_block_size - 1] == visible_times[-1]:
            latest_block_size += 1
    return perturbed, user_tie_groups, user_tied_events, latest_block_size


def rbo_dissimilarity(first, second, persistence=0.9):
    first, second = list(first), list(second)
    depth = max(len(first), len(second))
    if depth == 0:
        return 0.0
    seen_first, seen_second = set(), set()
    weighted = 0.0
    overlap = 0.0
    for index in range(depth):
        if index < len(first):
            seen_first.add(first[index])
        if index < len(second):
            seen_second.add(second[index])
        overlap = len(seen_first & seen_second) / float(index + 1)
        weighted += (1 - persistence) * (persistence ** index) * overlap
    similarity = weighted + (persistence ** depth) * overlap
    return float(1 - similarity)


def bootstrap_mean_ci(values, seed, draws=1000):
    """User bootstrap from notebook cell 11 (default draw count from cell 1)."""
    vals = np.asarray(values, dtype=float)
    vals = vals[np.isfinite(vals)]
    if len(vals) == 0:
        return (np.nan, np.nan)
    rng = np.random.RandomState(seed)
    means = np.empty(draws, dtype=float)
    for i in range(draws):
        means[i] = vals[rng.randint(0, len(vals), len(vals))].mean()
    return tuple(np.quantile(means, [0.025, 0.975]))


def reconstruct_filtered_events(ratings_file, user_map_file, item_map_file):
    """Notebook cell 3: one-pass 5-core and stable raw-timestamp ordering.

    Caller may compare the returned per-user sequences with upstream ml-1m.txt,
    as the notebook does. The checkpoint and raw source files are not modified.
    """
    import pandas as pd
    ratings = pd.read_csv(
        ratings_file, sep='::', engine='python', header=None,
        names=['original_user_id', 'original_movie_id', 'rating', 'timestamp'],
        dtype={'original_user_id': 'int32', 'original_movie_id': 'int32',
               'rating': 'int32', 'timestamp': 'int32'},
    )
    ratings['source_row'] = np.arange(len(ratings), dtype=np.int64)
    raw_user_counts = ratings.original_user_id.value_counts()
    raw_item_counts = ratings.original_movie_id.value_counts()
    filtered = ratings[
        ratings.original_user_id.map(raw_user_counts).ge(5)
        & ratings.original_movie_id.map(raw_item_counts).ge(5)
    ].copy()
    user_map = pd.read_csv(user_map_file, sep=r'\s+', header=None,
                           names=['sas_user_id', 'original_user_id'], dtype='int32')
    item_map = pd.read_csv(item_map_file, sep=r'\s+', header=None,
                           names=['sas_item_id', 'original_movie_id'], dtype='int32')
    filtered = filtered.merge(user_map, on='original_user_id', validate='many_to_one')
    filtered = filtered.merge(item_map, on='original_movie_id', validate='many_to_one')
    return filtered.sort_values(['sas_user_id', 'timestamp', 'source_row'], kind='mergesort')


def genre_membership_matrix(item_metadata, n_items, all_genres):
    """Notebook cell 5: one fractional membership unit per movie."""
    genre_to_index = {genre: i for i, genre in enumerate(all_genres)}
    genre_matrix = np.zeros((n_items, len(all_genres)), dtype=np.float32)
    for row in item_metadata.itertuples():
        labels = list(dict.fromkeys(row.genre_list))
        for label in labels:
            genre_matrix[int(row.sas_item_id) - 1, genre_to_index[label]] = 1.0 / len(labels)
    return genre_matrix
