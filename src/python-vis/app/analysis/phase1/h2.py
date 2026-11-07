"""H2: release-era shifts between recorded histories and recommendations."""
from collections import Counter
import numpy as np
from app.analysis.base import BaseAnalysis
from app.core.analysis_data import AnalysisPrerequisite


def year_summary(items, years):
    values = [years[item] for item in items if item in years]
    counts = Counter(year // 10 * 10 for year in values)
    return {'mean': float(np.mean(values)) if values else None, 'known': len(values),
            'missing': len(items) - len(values),
            'decades': {str(decade): count / len(values) for decade, count in sorted(counts.items())}}


class H2Analysis(BaseAnalysis):
    hypothesis = 'h2'
    requires_metadata = True
    methods = ['Mean release-year shifts', 'Release-decade distributions',
               'Eligible-catalog and training-popularity references']

    def run(self, config):
        self.data.require_metadata()
        years, genres = self.data.release_years, self.data.genres
        if not years:
            raise AnalysisPrerequisite('No release years could be parsed from verified movie titles')
        users = self.data.sample_users(config.max_users, config.seed, min_length=12)
        maxlen = int(self.ranker.model.config['maxlen'])
        records, cases = [], []
        skipped = 0
        for index, user in enumerate(users):
            history = self.data.history(user)
            context = history[-maxlen:]
            candidates = self.ranker.candidates(history)
            ranking = self.ranker.rank(history, candidates, config.top_k)
            recommended = year_summary(self.ranker.ids(ranking), years)
            catalog = year_summary(candidates, years)
            popular_ids = sorted(candidates, key=lambda item: (-self.data.popularity[item], item))[:len(ranking)]
            popular = year_summary(popular_ids, years)
            user_rows = []
            for window, items in [('recent', context[-20:]), ('context', context)]:
                past = year_summary(items, years)
                if past['mean'] is None or recommended['mean'] is None:
                    continue
                profile = self.metrics.genre_profile(items, genres)
                dominant = sorted(g for g, p in profile.items() if np.isclose(p, max(profile.values())))
                user_rows.append({'user_id': user, 'window': window, 'history_length': len(history),
                                  'window_length': len(items), 'history_mean_year': past['mean'],
                                  'recommendation_mean_year': recommended['mean'],
                                  'shift_years': recommended['mean'] - past['mean'],
                                  'history_mean_decade': f"{int(past['mean']) // 10 * 10}s",
                                  'dominant_genres': dominant,
                                  'history_known': past['known'], 'history_missing': past['missing'],
                                  'recommendation_known': recommended['known'],
                                  'recommendation_missing': recommended['missing'],
                                  'recommendation_count': len(ranking), 'candidate_count': len(candidates),
                                  'candidate_known': catalog['known'], 'candidate_missing': catalog['missing'],
                                  'catalog_mean_year': catalog['mean'],
                                  'popular_mean_year': popular['mean'], 'popular_known': popular['known'],
                                  'popular_missing': popular['missing'],
                                  'history_decades': past['decades'], 'recommendation_decades': recommended['decades'],
                                  'catalog_decades': catalog['decades']})
            records.extend(user_rows)
            if user_rows:
                cases.append({'example_id': f'h2-{user}', 'user_id': user, 'full_history': context,
                              'recommendations': ranking, 'history_mean_year': user_rows[0]['history_mean_year']})
            else:
                skipped += 1
            if getattr(self, 'progress', None):
                self.progress(index + 1, len(users), f'Compared release years for {index + 1}/{len(users)} users')
        if not records:
            raise AnalysisPrerequisite('No comparable histories and recommendations with known release years')
        # Cover the history-era range so older-history cases are inspectable too.
        cases.sort(key=lambda ex: (ex['history_mean_year'], ex['user_id']))
        positions = np.linspace(0, len(cases) - 1, min(config.max_examples, len(cases)), dtype=int)
        examples = [cases[int(i)] for i in positions]
        for example in examples:
            ids = list(dict.fromkeys(example['full_history'] + self.ranker.ids(example['recommendations'])))
            example['movies'] = [{**movie, 'release_year': years.get(movie['item_id'])}
                                 for movie in self.data.repository.metadata.movie_details(ids)]
        return self.output(records, examples,
                           {'n_users': len(cases), 'maxlen': maxlen, 'skipped_users': skipped,
                            'catalog_missing_years': len(genres) - len(years),
                            'min_year': min(years.values()), 'max_year': max(years.values())},
                           ['History means use the latest 20 or full model-visible training interactions. '
                            'Recommendations are identical for both reference windows; validation/test events are excluded.',
                            'Each known-year movie has equal weight. Missing years are excluded from means and decade shares; '
                            'counts are shown. A newer mean is not proof of lower accuracy or satisfaction.',
                            'The catalog reference weights each eligible unseen movie equally. The popularity reference '
                            'takes the same number of movies with the largest training interaction counts (ties by movie ID).',
                            'Genre filters select users by their dominant historical genre, including all ties; '
                            'they do not restrict recommendations to that genre or remove confounding.',
                            'Newer means a later release year within this historical dataset, not a recent release today. '
                            'Rating histories include disliked movies and do not necessarily represent viewing order.'])
