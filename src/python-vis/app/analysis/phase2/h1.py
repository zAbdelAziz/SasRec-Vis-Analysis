"""H1: genre-pair attention with a position-matched descriptive baseline."""
import numpy as np
from app.analysis.phase2.base import BaseInternalAnalysis
from app.explain.attention import AttentionExtractor
from app.core.genre_analysis import aggregate_pairs, movie_lookup, genre_labels
from app.core.attention_diagnostics import audit_diagnostics


class H1Internal(BaseInternalAnalysis):
    hypothesis = 'h1'
    requires_metadata = True
    methods = ['Actual per-head causal attention', 'Fractional genre-pair means', 'Position-matched residuals']

    def run(self, config):
        extractor = AttentionExtractor(self.ranker.model)
        genres = self.data.genres
        labels = sorted({g for values in genres.values() for g in values})
        movies = movie_lookup(self.data)
        for item in movies:
            genre_labels(item, genres)
        users = self.data.sample_users(config.max_users, config.seed, min_length=2)
        size = int(self.ranker.model.config['maxlen'])
        total, count = np.zeros((size, size)), np.zeros((size, size))
        snapshots = []
        for idx, user in enumerate(users):
            snap = extractor.snapshot(self.data.history(user), config.attention_layer, config.attention_head)
            # Analyze the selected suffix of the unchanged model-visible sequence.
            n = min(len(snap['items']), config.history_window or size)
            values = snap['attention'][-n:, -n:]
            snap['retained_row_mass'] = values.sum(axis=-1).tolist()
            snap.update(user_id=user, items=snap['items'][-n:], attention=values)
            start = size - n
            total[start:, start:] += values
            count[start:, start:] += np.tril(np.ones((n, n)))
            snapshots.append(snap)
            if getattr(self, 'progress', None):
                self.progress(idx+1, len(users), 'Extracting causal attention probabilities')
        baseline = np.divide(total, count, out=np.zeros_like(total), where=count > 0)
        details, comparisons = [], []
        rng = np.random.default_rng(config.seed)
        for snap in snapshots:
            items, attention = snap['items'], snap['attention']
            n = len(items)
            residual = attention - baseline[-n:, -n:]
            cells = aggregate_pairs(items, genres, attention, residual, labels)
            q, k = np.tril_indices(n, -1)  # Self-attention trivially shares every genre.
            jaccard = np.array([len(set(genres[items[i]]) & set(genres[items[j]])) /
                               len(set(genres[items[i]]) | set(genres[items[j]])) for i, j in zip(q, k)])
            raw, adjusted = attention[q, k], residual[q, k]
            for overlap in (False, True):
                mask = (jaccard > 0) == overlap
                if mask.any():
                    comparisons.append({'user_id': snap['user_id'], 'overlap': overlap,
                                        'count': int(mask.sum()), 'raw_mean': float(raw[mask].mean()),
                                        'adjusted_mean': float(adjusted[mask].mean())})
            # Reproducible display sample only; matrices and group means use all pairs.
            chosen = rng.choice(len(q), min(500, len(q)), replace=False)
            pairs = [{'user_id': snap['user_id'], 'jaccard': float(jaccard[i]),
                      'distance': int(q[i]-k[i]), 'raw': float(raw[i]),
                      'adjusted': float(adjusted[i])} for i in chosen]
            details.append({'example_id': f'h1-{snap["user_id"]}', 'user_id': snap['user_id'],
                            'history_movies': [dict(movies[item], position=j+1) for j, item in enumerate(items)],
                            'attention': [[float(attention[i, j]) if j <= i else None for j in range(n)] for i in range(n)],
                            'padding_mass': snap['padding_mass'],
                            'row_real_mass': snap['row_real_mass'], 'row_padding_mass': snap['row_padding_mass'],
                            'retained_row_mass': snap['retained_row_mass'],
                            'normalization_max_error': snap['normalization_max_error'],
                            'logit_max_error': snap['logit_max_error'], 'cells': cells, 'pairs': pairs,
                            'pair_count': len(q), 'baseline_min_users': int(count[-n:, -n:][np.tril_indices(n)].min())})
        diagnostics = audit_diagnostics(snapshots, genres, labels, movies, config.seed)
        return self.output(comparisons, details[:config.max_examples],
                           {'diagnostics': diagnostics, 'genres': labels, 'users': details, 'comparisons': comparisons,
                            'layer_count': len(extractor.model.attention_layers),
                            'head_count': extractor.model.attention_layers[config.attention_layer].num_heads},
                           ['Actual attention probabilities from the unchanged checkpoint. Future and padding positions are excluded; retained rows are not renormalized. A selected suffix can omit attention to earlier real movies.',
                            'Adjusted attention subtracts the sample mean at the same absolute model query and key positions (matching distance, but not the number of real keys or padding mass). The baseline includes the inspected user and is descriptive; with one user residuals are zero.',
                            'Genre cells are fractional weighted means, with raw pair counts and fractional observation mass. Self-pairs are included in matrices but excluded from overlap/Jaccard comparisons.',
                            'Distribution and Jaccard plots use at most 500 fixed-seed pairs per user. Group means and genre matrices use all valid pairs. Attention is not a causal explanation.'])
