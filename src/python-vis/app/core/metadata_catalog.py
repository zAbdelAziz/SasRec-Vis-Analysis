"""Optional, explicitly validated SASRec-to-MovieLens metadata joins."""
from functools import cached_property
from typing import TYPE_CHECKING
import pandas as pd
from app.config import Settings

if TYPE_CHECKING:
    from app.core.data_repository import DataRepository


class MovieLensMetadata:
    """Never expose metadata by SASRec ID without validating the mapping first."""

    def __init__(self, settings: Settings, data: "DataRepository"):
        self.settings = settings
        self.data = data
        self.mapping_folder = settings.project_root / "src/data/mapping-source"

    @cached_property
    def item_map(self) -> pd.DataFrame:
        return self._read_map("sas_to_original_items.txt", "item_id", "original_movie_id")

    @cached_property
    def user_map(self) -> pd.DataFrame:
        return self._read_map("sas_to_original_users.txt", "user_id", "original_user_id")

    def _read_map(self, filename: str, internal: str, original: str) -> pd.DataFrame:
        frame = pd.read_csv(
            self.mapping_folder / filename,
            sep=r"\s+", header=None, names=[internal, original], dtype="int32",
        )
        if (frame <= 0).any().any() or frame[internal].duplicated().any() or frame[original].duplicated().any():
            raise ValueError(f"Invalid or duplicate IDs in {filename}")
        return frame

    @cached_property
    def ratings(self) -> pd.DataFrame:
        return pd.read_csv(
            self.settings.raw_movielens / "ratings.dat", sep="::", engine="python",
            names=["original_user_id", "original_movie_id", "rating", "timestamp"],
            dtype="int32",
        )

    @cached_property
    def movies(self) -> pd.DataFrame:
        return pd.read_csv(
            self.settings.raw_movielens / "movies.dat", sep="::", engine="python",
            names=["original_movie_id", "title", "genres"], encoding="latin-1",
        )

    @cached_property
    def users(self) -> pd.DataFrame:
        return pd.read_csv(
            self.settings.raw_movielens / "users.dat", sep="::", engine="python",
            names=["original_user_id", "gender", "age", "occupation", "zip_code"],
            dtype={"original_user_id": "int32", "zip_code": "str"},
        )

    @property
    def missing_files(self) -> list[str]:
        required = [self.mapping_folder / name for name in
                    ('sas_to_original_items.txt', 'sas_to_original_users.txt')]
        required += [self.settings.raw_movielens / name for name in
                     ('ratings.dat', 'movies.dat', 'users.dat')]
        return [str(path.relative_to(self.settings.project_root))
                for path in required if not path.is_file()]

    @property
    def validation(self) -> dict:
        """Cache the expensive million-row verification until the files change."""
        required = [self.mapping_folder / name for name in
                    ('sas_to_original_items.txt', 'sas_to_original_users.txt')]
        required += [self.settings.raw_movielens / name for name in
                     ('ratings.dat', 'movies.dat', 'users.dat')]
        signature = tuple((path.stat().st_size, path.stat().st_mtime_ns)
                          if path.is_file() else None for path in required)
        if signature != getattr(self, '_last_validation_signature', object()):
            for key in ('item_map', 'user_map', 'ratings', 'movies', 'users'):
                self.__dict__.pop(key, None)
            self._last_validation = self._verify()
            self._last_validation_signature = signature
        return self._last_validation

    def _verify(self) -> dict:
        needed = [self.mapping_folder / "sas_to_original_items.txt",
                  self.mapping_folder / "sas_to_original_users.txt"]
        if not all(path.is_file() for path in needed):
            return {"state": "missing", "message": "Recovered ID mapping not installed"}
        source_files = [self.settings.raw_movielens / name for name in
                        ("ratings.dat", "movies.dat", "users.dat")]
        if not all(file.is_file() for file in source_files):
            return {"state": "provided_unverified", "message": "Add all three original MovieLens .dat files to verify mapping"}
        if not self.data.available:
            return {"state": "provided_unverified", "message": "Processed interactions required for verification"}
        try:
            items, users = self.item_map, self.user_map
            if self.movies.original_movie_id.duplicated().any():
                raise ValueError("Duplicate original movie IDs in movies.dat")
            if self.movies.genres.isna().any() or self.movies.genres.astype(str).apply(
                    lambda value: any(not g.strip() or g == '(no genres listed)' for g in value.split('|'))).any():
                raise ValueError("Missing movie genres in movies.dat")
            processed = self.data.interactions
            if not set(items.original_movie_id).issubset(set(self.movies.original_movie_id)):
                raise ValueError("Mapped movie IDs are absent from movies.dat")
            if not set(users.original_user_id).issubset(set(self.users.original_user_id)):
                raise ValueError("Mapped user IDs are absent from users.dat")
            if len(items) != self.data.item_count or len(users) != self.data.user_count:
                raise ValueError("Mapping size does not match model vocabulary")
            if set(items.item_id) != set(range(1, self.data.item_count + 1)):
                raise ValueError("Item mapping does not cover contiguous internal IDs")
            if set(users.user_id) != set(range(1, self.data.user_count + 1)):
                raise ValueError("User mapping does not cover contiguous internal IDs")
            # Verify every interaction, not merely the number of mapped items.
            mapped = processed.merge(users, on="user_id", validate="many_to_one")
            mapped = mapped.merge(items, on="item_id", validate="many_to_one")
            raw = self.ratings
            valid_ids = raw.original_movie_id.isin(items.original_movie_id) & raw.original_user_id.isin(users.original_user_id)
            raw = raw.loc[valid_ids]
            cols = ["original_user_id", "original_movie_id"]
            left = mapped.groupby(cols).size().rename("processed_count")
            right = raw.groupby(cols).size().rename("raw_count")
            counts = left.to_frame().join(right, how="outer").fillna(0)
            if not bool((counts.processed_count == counts.raw_count).all()):
                raise ValueError("Mapped event counts differ from original MovieLens ratings")
            # Check timestamps are chronological in the upstream sequence order.
            stamped = mapped.merge(self.ratings[cols + ["timestamp"]], on=cols, validate="one_to_one")
            if (stamped.groupby("user_id", sort=False).timestamp.diff().dropna() < 0).any():
                raise ValueError("Processed sequences do not follow original rating timestamps")
            return {"state": "verified", "message": "Item/user mappings match all processed rating events and chronology"}
        except (ValueError, KeyError, OSError, pd.errors.ParserError) as exc:
            return {"state": "invalid", "message": str(exc)}

    def movie_details(self, item_ids: list[int]) -> list[dict]:
        if self.validation["state"] != "verified":
            return []
        joined = self.item_map.merge(self.movies, on="original_movie_id", how="left", validate="one_to_one")
        by_id = joined.set_index("item_id")
        result = []
        for item_id in item_ids:
            if item_id not in by_id.index:
                continue
            row = by_id.loc[item_id]
            result.append({"item_id": int(item_id), "original_movie_id": int(row.original_movie_id),
                           "title": str(row.title), "genres": str(row.genres).split("|")})
        return result
