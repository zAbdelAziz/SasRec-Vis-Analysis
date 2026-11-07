"""Visible H3 Phase I: demographic differences in genre amplification."""
from app.analysis.base import BaseAnalysis
from app.analysis.phase1.h1 import H1Analysis
from app.core.demographic_genres import AGE_LABELS, GENDERS, SHARE_BINS, demographic_summaries


class H3Analysis(BaseAnalysis):
    hypothesis = 'h3'
    requires_metadata = True
    methods = ['H1 full-catalog unseen-item recommendations', 'Fractional genre differences',
               'User-level percentile bootstrap (2,000 resamples)', 'Historical-share bin comparisons']

    def run(self, config):
        self.data.require_metadata()
        preparation=H1Analysis(self.data,self.ranker)
        preparation.progress=getattr(self,'progress',None)
        original=preparation.run(config)
        demographics=self.data.demographics
        users=[]
        for user in original['views']['users']:
            demo=demographics.get(user['user_id'],{})
            age,gender=demo.get('age'),demo.get('gender')
            if age not in AGE_LABELS or gender not in GENDERS:
                continue
            delta={g:user['recommendation_profile'].get(g,0)-user['history_profile'].get(g,0)
                   for g in original['views']['genres']}
            users.append(dict(user,example_id=f'h3-{user["user_id"]}',age_code=age,
                              age_label=AGE_LABELS[age],gender=gender,amplification=delta,
                              history_length=len(user['full_history'])))
        genres=original['views']['genres']
        groups,bins=demographic_summaries(users,genres,config.seed)
        records=[{key:value for key,value in u.items() if key not in
                  ('history','full_history','history_movies','recommendations')} for u in users]
        return self.output(records,users[:config.max_examples],
                           dict(users=users,genres=genres,ages=AGE_LABELS,genders=GENDERS,
                                groups=groups,preference_bins=bins,bin_labels=SHARE_BINS,
                                n_users=len(users),excluded_metadata=len(original['views']['users'])-len(users),
                                bootstrap_resamples=2000,min_matched_users=5,analysis='demographic_genre_amplification'),
                           original['notes'][:2]+[
                               'Age and gender are original MovieLens subgroup attributes; this SASRec implementation takes item sequences and does not use demographic features.',
                               'Delta is recommendation share minus historical share; charts express it in percentage points. Each user contributes once to each group/genre estimate.',
                               '95% percentile bootstrap intervals resample paired user differences 2,000 times with fixed seeds. No interval is estimated for fewer than two users. Groups below five users are flagged; intervals are not tests of demographic differences.',
                               'Unadjusted group means can reflect different input preferences. The optional binned comparison conditions only on the selected genre share in 20-point bins, not full genre profiles, history length, or other confounders. Cells below five users are suppressed in that comparison.',
                               'Historical rating distributions are reference profiles, not satisfaction measures. Differences do not establish demographic causation or discrimination.'])
