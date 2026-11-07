"""Visible H9 (internal h11): full-catalog next-item accuracy by age group."""
from itertools import product
import math
import numpy as np
from app.analysis.base import BaseAnalysis
from app.core.analysis_data import AnalysisPrerequisite

AGE_LABELS = {'1': 'Under 18', '18': '18–24', '25': '25–34', '35': '35–44',
              '45': '45–49', '50': '50–55', '56': '56+'}


def wilson(hits, count):
    """95% Wilson interval, including zero/all hits; no estimate for empty groups."""
    if not count:
        return [None, None]
    z = 1.959963984540054
    p = hits / count
    divisor = 1 + z*z/count
    center = (p + z*z/(2*count)) / divisor
    half = z * math.sqrt(p*(1-p)/count + z*z/(4*count*count)) / divisor
    return [max(0.0, center-half), min(1.0, center+half)]


def age_summaries(records):
    """Precompute the UI's descriptive cohorts; one observation per user per cohort."""
    genres = sorted({g for row in records for g in row['dominant_genres']})
    groups = []
    for genre, band, (code, label) in product(['all', *genres], ['all', '<50', '50–199', '200+'], AGE_LABELS.items()):
        cohort = [r for r in records if r['age_code'] == code
                  and (genre == 'all' or genre in r['dominant_genres'])
                  and (band == 'all' or r['history_band'] == band)]
        n = len(cohort)
        hits = sum(r['hit_at_10'] for r in cohort)
        baseline_hits = sum(r['popularity_hit_at_10'] for r in cohort)
        groups.append({'genre': genre, 'history_band': band, 'age_code': code, 'age_label': label,
                       'n': n, 'hits': hits, 'hit_at_10': hits/n if n else None,
                       'hit_ci': wilson(hits, n), 'popularity_hits': baseline_hits,
                       'popularity_hit_at_10': baseline_hits/n if n else None,
                       'popularity_ci': wilson(baseline_hits, n),
                       'ndcg_at_10': float(np.mean([r['ndcg_at_10'] for r in cohort])) if n else None})
    return groups


class H11Analysis(BaseAnalysis):
    hypothesis = 'h11'
    requires_metadata = True
    methods = ['Full-catalog test Hit@10 and NDCG@10', 'Age cohorts with 95% Wilson intervals',
               'Training-popularity baseline', 'Genre and history-length cohort filters']

    def run(self, config):
        self.data.require_metadata()
        demographics, genres = self.data.demographics, self.data.genres
        eligible = [u for u, seq in self.data.histories.items() if len(seq) >= 4
                    and demographics.get(u, {}).get('age') in AGE_LABELS]
        if not eligible:
            raise AnalysisPrerequisite('No eligible users with recognized MovieLens age groups')
        rng = np.random.default_rng(config.seed % (2**32))
        users = rng.choice(eligible, min(config.max_users, len(eligible)), replace=False).tolist()
        records, case_data = [], {}
        maxlen = int(self.ranker.model.config['maxlen'])
        for index, user in enumerate(users):
            sequence = self.data.histories[user]
            # Standard test prefix includes validation interaction, never the test target.
            history, target = sequence[:-1], sequence[-1]
            candidates = sorted(set(self.ranker.candidates(history)) | {target})
            scores = self.ranker.model.score(history, candidates)
            if not np.isfinite(scores).all():
                raise AnalysisPrerequisite('Model returned non-finite candidate scores')
            # Candidates are sorted: stable score sorting breaks ties by item ID.
            order = np.argsort(-scores, kind='stable')
            ranked_ids = [candidates[int(i)] for i in order]
            target_rank = ranked_ids.index(target) + 1
            target_score = float(scores[candidates.index(target)])
            alternative = next((item for item in ranked_ids if item != target), None)
            popular = sorted(candidates, key=lambda item: (-self.data.popularity[item], item))
            popular_rank = popular.index(target) + 1
            context = history[-maxlen:]
            profile = self.metrics.genre_profile(context[-20:], genres)
            dominant = sorted(g for g, p in profile.items() if np.isclose(p, max(profile.values())))
            age = demographics[user]['age']
            record = {'user_id': user, 'age_code': age, 'age_label': AGE_LABELS[age],
                      'history_length': len(history), 'context_length': len(context),
                      'history_band': '<50' if len(history) < 50 else '50–199' if len(history) < 200 else '200+',
                      'dominant_genres': dominant, 'target_id': target, 'target_genres': genres[target],
                      'target_popularity': self.data.popularity[target],
                      'target_popularity_band': self.data.popularity_bin(target),
                      'candidate_count': len(candidates), 'target_rank': target_rank,
                      'hit_at_10': int(target_rank <= 10),
                      'ndcg_at_10': float(1 / np.log2(target_rank + 1)) if target_rank <= 10 else 0.0,
                      'popularity_rank': popular_rank, 'popularity_hit_at_10': int(popular_rank <= 10),
                      'target_score': target_score, 'alternative_id': alternative,
                      'alternative_score': float(scores[candidates.index(alternative)]) if alternative else None}
            records.append(record)
            # Always save exactly the evaluated top ten, independently of the common top_k option.
            case_data[user] = {**record, 'example_id': f'h11-{user}', 'full_history': context,
                               'history': context[-20:],
                               'recommendations': self.ranker.rank_scores(candidates, scores, 10)}
            if getattr(self, 'progress', None):
                self.progress(index + 1, len(users), f'Evaluated next-movie accuracy for {index + 1}/{len(users)} users')
        # Round-robin age/outcome buckets to cover both successes and misses, not just early IDs.
        buckets = [[r['user_id'] for r in records if r['age_code'] == code and r['hit_at_10'] == hit]
                   for hit in (0, 1) for code in AGE_LABELS]
        chosen = []
        while len(chosen) < min(config.max_examples, len(records)):
            for bucket in buckets:
                if bucket and len(chosen) < config.max_examples:
                    chosen.append(bucket.pop(0))
        examples = [case_data[u] for u in chosen]
        for ex in examples:
            ids = list(dict.fromkeys(ex['history'] + [ex['target_id']] + self.ranker.ids(ex['recommendations'])))
            ex['movies'] = self.data.repository.metadata.movie_details(ids)
        return self.output(records, examples,
                           {'groups': age_summaries(records), 'ages': AGE_LABELS,
                            'eligible_users': len(eligible), 'n_users': len(records), 'cutoff': 10,
                            'split': 'test', 'maxlen': maxlen},
                           ['Correct means the final recorded movie appears in the top 10. It is a next-rating-event metric, '
                            'not a measure of enjoyment. One test event is evaluated per sampled user.',
                            'Users are sampled uniformly without replacement. Age codes are bands, not exact ages. '
                            'The context includes the validation event but never the final test event; popularity uses training events only.',
                            'Every catalog item absent from the context is a candidate, with the target always retained. '
                            'Score ties break by item ID. This differs from the separate 100-negative benchmark.',
                            'Intervals are descriptive 95% Wilson intervals for each hit rate, not a significance test of group differences. '
                            'Small groups and repeated filtering can produce unstable patterns.',
                            'Genre and history-length filters select comparable broad cohorts, but do not eliminate confounding. '
                            'Age is not a model input; differences alone do not establish discrimination.'])
