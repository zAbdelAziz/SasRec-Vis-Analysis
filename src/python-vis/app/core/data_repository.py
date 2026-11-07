"""Read SASRec interaction order and optional MovieLens source metadata."""
from functools import cached_property
import pandas as pd
from app.config import Settings


class DataRepository:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def available(self) -> bool:
        return self.settings.interactions.is_file()

    @cached_property
    def interactions(self) -> pd.DataFrame:
        if not self.available:
            raise FileNotFoundError(
                f"Missing processed interactions: {self.settings.interactions}. "
                "Run 'npm run setup:model' or set SASREC_DATA_PATH."
            )
        # Row order is the historical order stored by the original SASRec code.
        frame = pd.read_csv(
            self.settings.interactions, sep=r"\s+", header=None,
            names=["user_id", "item_id"], dtype="int32",
        )
        if frame.empty or frame.isna().any().any():
            raise ValueError("Processed interactions are empty or contain missing values")
        if frame[["user_id", "item_id"]].le(0).any().any():
            raise ValueError("User and item IDs must be positive; 0 is reserved for padding")
        return frame

    @cached_property
    def histories(self) -> dict[int, list[int]]:
        return {
            int(user): [int(value) for value in values]
            for user, values in self.interactions.groupby("user_id", sort=False)["item_id"]
        }

    @cached_property
    def metadata(self):
        from app.core.metadata_catalog import MovieLensMetadata
        return MovieLensMetadata(self.settings, self)

    @property
    def raw_counts(self) -> dict[str, int | bool]:
        folder = self.settings.raw_movielens
        files = {name: (folder / name).is_file() for name in
                 ("ratings.dat", "movies.dat", "users.dat")}
        return {
            "present": all(files.values()),
            "ratings_file": files["ratings.dat"],
            "movies_file": files["movies.dat"],
            "users_file": files["users.dat"],
        }

    def summary(self) -> dict:
        if not self.available:
            return {"ready": False, "message": "Model training data not installed"}
        rows = self.interactions
        lengths = rows.groupby("user_id", sort=False).size()
        count_users = int(rows.user_id.nunique())
        count_items = int(rows.item_id.nunique())
        contiguous_users = count_users == int(rows.user_id.max())
        contiguous_items = count_items == int(rows.item_id.max())
        return {
            "ready": True,
            "interactions": int(len(rows)),
            "users": count_users,
            "items": count_items,
            "max_user_id": int(rows.user_id.max()),
            "max_item_id": int(rows.item_id.max()),
            "average_history_length": round(float(lengths.mean()), 1),
            "min_history_length": int(lengths.min()),
            "max_history_length": int(lengths.max()),
            "contiguous_user_ids": contiguous_users,
            "contiguous_item_ids": contiguous_items,
            "raw_metadata": self.raw_counts,
            "id_mapping": self.metadata.validation["state"],
            "mapping_message": self.metadata.validation["message"],
            "missing_metadata_files": self.metadata.missing_files,
            "note": "Stored order is used as sequence order; raw metadata is not automatically joined.",
        }

    def get_history(self, user_id: int, split: str = "full", limit: int = 30) -> dict:
        if user_id not in self.histories:
            raise KeyError(f"User {user_id} does not exist")
        full = self.histories[user_id]
        if split == "train":
            selected = full[:-2] if len(full) >= 4 else full
        elif split == "validation":
            selected = full[-2:-1] if len(full) >= 4 else []
        elif split == "test":
            selected = full[-1:] if len(full) >= 4 else []
        elif split == "test_context":
            selected = full[:-1] if len(full) >= 4 else full
        elif split == "full":
            selected = full
        else:
            raise ValueError("Unknown split")
        return {
            "user_id": user_id,
            "split": split,
            "total_interactions": len(selected),
            "items": selected[-limit:],
            "truncated": len(selected) > limit,
            "id_space": "sasrec_internal",
            "movie_details": self.metadata.movie_details(selected[-limit:]),
        }

    def get_evaluation_cases(self, split: str = "test", max_users: int = 100) -> list[dict]:
        if split not in {"test", "validation"}:
            raise ValueError("split must be 'test' or 'validation'")
        cases = []
        for user_id, full in self.histories.items():
            if len(full) < 4:
                continue
            context = full[:-1] if split == "test" else full[:-2]
            target = full[-1] if split == "test" else full[-2]
            cases.append({"user_id": user_id, "history": context,
                          "target": target, "seen": set(full)})
            if len(cases) >= max_users:
                break
        return cases

    @property
    def user_count(self) -> int:
        return int(self.interactions.user_id.max())

    @property
    def item_count(self) -> int:
        return int(self.interactions.item_id.max())
