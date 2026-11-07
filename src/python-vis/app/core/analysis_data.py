"""External data and training-only descriptive statistics for Phase I."""
from collections import Counter
from functools import cached_property
import pandas as pd
from app.core.metrics import Metrics


class AnalysisPrerequisite(ValueError):
    pass


class AnalysisData:
    def __init__(self, repository):
        self.repository = repository
        self.metrics = Metrics()

    @property
    def histories(self):
        return self.repository.histories

    @cached_property
    def training(self):
        return {user: items[:-2] if len(items) >= 4 else items
                for user, items in self.histories.items()}

    @cached_property
    def popularity(self):
        return Counter(item for history in self.training.values() for item in history)

    @property
    def metadata_ready(self):
        return self.repository.metadata.validation['state'] == 'verified'

    def require_metadata(self):
        ready = self.metadata_ready
        signature = self.repository.metadata._last_validation_signature
        if signature != getattr(self, '_metadata_signature', None):
            for key in ('genres', 'release_years', 'event_ratings', 'demographics'):
                self.__dict__.pop(key, None)
            self._metadata_signature = signature
        if not ready:
            raise AnalysisPrerequisite('Verified MovieLens-to-SASRec ID mapping and original metadata required: '
                                       + self.repository.metadata.validation['message'])

    @cached_property
    def genres(self):
        self.require_metadata()
        metadata = self.repository.metadata
        table = metadata.item_map.merge(metadata.movies, on='original_movie_id', validate='one_to_one')
        return {int(row.item_id): str(row.genres).split('|') for row in table.itertuples()}

    @cached_property
    def release_years(self):
        self.require_metadata()
        meta = self.repository.metadata
        table = meta.item_map.merge(meta.movies, on='original_movie_id', validate='one_to_one')
        # MovieLens encodes release year as the final parenthesized title suffix.
        years = table.title.str.extract(r'\((\d{4})\)\s*$')[0]
        return {int(item): int(year) for item, year in zip(table.item_id, years) if pd.notna(year)}

    @cached_property
    def event_ratings(self):
        self.require_metadata()
        meta = self.repository.metadata
        mapped = (meta.ratings.merge(meta.user_map, on='original_user_id')
                  .merge(meta.item_map, on='original_movie_id'))
        return {(int(row.user_id), int(row.item_id)): int(row.rating) for row in mapped.itertuples()}

    @cached_property
    def demographics(self):
        self.require_metadata()
        meta = self.repository.metadata
        users = meta.user_map.merge(meta.users, on='original_user_id')
        return {int(row.user_id): {'gender': str(row.gender), 'age': str(row.age),
                                   'occupation': str(row.occupation)} for row in users.itertuples()}

    def history(self, user_id):
        return list(self.training[int(user_id)])

    def sample_users(self, max_users=50, seed=42, min_length=12):
        import numpy as np
        available = [u for u, h in self.training.items() if len(h) >= min_length]
        rng = np.random.default_rng(seed)
        if not available:
            raise AnalysisPrerequisite('Not enough users with suitable interaction histories')
        selected = rng.choice(available, size=min(len(available), int(max_users)), replace=False)
        return [int(user) for user in selected]

    @cached_property
    def popularity_thresholds(self):
        import numpy as np
        return np.quantile(list(self.popularity.values()), [.2, .4, .6, .8]) if self.popularity else []

    def popularity_bin(self, item):
        if not self.popularity:
            return 'unknown'
        import numpy as np
        value = self.popularity.get(int(item), 0)
        return ['Q1 rare', 'Q2', 'Q3', 'Q4', 'Q5 popular'][
            int(np.searchsorted(self.popularity_thresholds, value, side='left'))]

    def context_profile(self, user, count=10):
        return self.metrics.genre_profile(self.history(user)[-count:], self.genres)
