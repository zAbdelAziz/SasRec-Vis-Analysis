"""H1: genre representation and dominant-genre amplification."""
import numpy as np
from app.analysis.base import BaseAnalysis
from app.core.genre_analysis import profile, movie_lookup


class H1Analysis(BaseAnalysis):
    hypothesis = 'h1'
    requires_metadata = True
    methods = ['Fractional genre allocation', 'Full-catalog unseen-item ranking']

    def run(self, config):
        genres = self.data.genres
        labels = sorted({g for values in genres.values() for g in values})
        movies = movie_lookup(self.data)
        users = self.data.sample_users(config.max_users, config.seed, min_length=2)
        histories = [self.data.history(u) for u in users]
        candidates = list(range(1, self.data.repository.item_count + 1))
        records, details, dominant = [], [], []
        # Bound both model and score-array memory; mask every training-seen item.
        for start in range(0, len(users), 6):
            scores = self.ranker.model.score_many(histories[start:start+6], candidates)
            for offset, values in enumerate(scores):
                idx = start + offset
                user, full = users[idx], histories[idx]
                history = full[-config.history_window:] if config.history_window else full
                seen = set(full)
                eligible = np.array([i for i in candidates if i not in seen])
                if not len(eligible):
                    continue
                ranking = self.ranker.rank_scores(eligible, values[eligible - 1], config.top_k)
                hp = profile(history, genres)
                rp = profile(self.ranker.ids(ranking), genres)
                tied = sorted(g for g in hp if np.isclose(hp[g], max(hp.values())))
                main = tied[0]
                row = {'user_id': user, 'genre': main, 'history_share': hp[main],
                       'recommendation_share': rp.get(main, 0),
                       'amplification': rp.get(main, 0) - hp[main], 'tied_genres': tied}
                dominant.append(row)
                records.extend({'user_id': user, 'genre': g, 'history_share': hp.get(g, 0),
                                'recommendation_share': rp.get(g, 0),
                                'difference': rp.get(g, 0) - hp.get(g, 0)} for g in labels)
                details.append({'example_id': f'h1-{user}', 'user_id': user,
                                'history': history, 'full_history': full,
                                'history_movies': [dict(movies[i], position=j+1) for j, i in enumerate(history)],
                                'recommendations': [dict(movies[r['item_id']], **r) for r in ranking],
                                'history_profile': hp, 'recommendation_profile': rp})
            if getattr(self, 'progress', None):
                self.progress(min(start+6, len(users)), len(users), 'Comparing genre distributions')
        values = [r['amplification'] for r in dominant]
        summary = {'users': len(details), 'mean': float(np.mean(values)) if values else None,
                   'median': float(np.median(values)) if values else None,
                   'positive_percent': 100 * sum(v > 0 for v in values) / len(values) if values else None}
        return self.output(records, details[:config.max_examples],
                           {'genre_pairs': records, 'dominant': dominant, 'users': details,
                            'genres': labels, 'summary': summary},
                           ['Training-only histories; validation and test events are withheld. Model input remains the full training history, truncated by model maxlen; the selected window changes the comparison profile only.',
                            'Every movie splits one unit equally across its genres. All training-seen items are excluded from recommendations.',
                            'Dominant-genre ties are resolved alphabetically and disclosed. Historical shares are reference profiles, not ideal recommendation targets.'])
