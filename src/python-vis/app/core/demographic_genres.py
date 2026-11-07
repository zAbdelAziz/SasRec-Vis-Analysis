"""User-level demographic genre differences and reproducible uncertainty."""
from hashlib import sha256
import numpy as np

AGE_LABELS = {'1': 'Under 18', '18': '18–24', '25': '25–34', '35': '35–44',
              '45': '45–49', '50': '50–55', '56': '56+'}
GENDERS = ['F', 'M']
SHARE_BINS = ['0–<20%', '20–<40%', '40–<60%', '60–<80%', '80–100%']


def share_bin(value):
    if not 0 <= value <= 1 + 1e-10:
        raise ValueError('Genre share outside [0,1]')
    return min(4, int(np.searchsorted([.2, .4, .6, .8], value, side='right')))


def summarize(history, recommendations, seed=42, resamples=2000):
    """One paired history/recommendation difference per user. Percentile bootstrap."""
    h, r = np.asarray(history, dtype=float), np.asarray(recommendations, dtype=float)
    if h.shape != r.shape or not np.isfinite(h).all() or not np.isfinite(r).all():
        raise ValueError('Invalid paired genre shares')
    delta = r-h
    n = len(delta)
    if not n:
        return dict(n=0, history_mean=None, recommendation_mean=None, mean=None,
                    median=None, std=None, positive_percent=None, ci_low=None, ci_high=None,
                    sparse=True)
    low, high = None, None
    if n >= 2:
        rng = np.random.default_rng(seed)
        means = delta[rng.integers(0,n,size=(resamples,n))].mean(axis=1)
        low, high = (float(v) for v in np.quantile(means,[.025,.975]))
    return dict(n=n, history_mean=float(h.mean()), recommendation_mean=float(r.mean()),
                mean=float(delta.mean()), median=float(np.median(delta)),
                std=float(delta.std(ddof=1)) if n>1 else None,
                positive_percent=100*float(np.mean(delta>0)), ci_low=low, ci_high=high,
                sparse=n<5)


def demographic_summaries(users, genres, seed=42, resamples=2000):
    groups, bins = [], []
    for age in AGE_LABELS:
        for gender in GENDERS:
            cohort = [u for u in users if u['age_code']==age and u['gender']==gender]
            for genre in genres:
                for bin_id in [-1,0,1,2,3,4]:
                    selected = cohort if bin_id==-1 else [u for u in cohort if share_bin(u['history_profile'].get(genre,0))==bin_id]
                    # Stable per-cell seed; changing presentation order cannot change intervals.
                    token=f'{seed}:{age}:{gender}:{genre}:{bin_id}'
                    cell_seed=int.from_bytes(sha256(token.encode()).digest()[:8],'little')
                    summary=summarize([u['history_profile'].get(genre,0) for u in selected],
                                      [u['recommendation_profile'].get(genre,0) for u in selected],
                                      cell_seed,resamples)
                    row=dict(age_code=age,age_label=AGE_LABELS[age],gender=gender,genre=genre,
                             bin=bin_id,**summary)
                    (groups if bin_id==-1 else bins).append(row)
    return groups,bins
