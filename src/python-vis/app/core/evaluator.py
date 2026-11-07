"""Small reproducible paper-style evaluation after a checkpoint is available."""
import numpy as np
from app.core.data_repository import DataRepository
from app.core.model_adapter import SASRecAdapter


class BenchmarkEvaluator:
    def __init__(self, data: DataRepository, model: SASRecAdapter):
        self.data = data
        self.model = model

    def evaluate(self, split: str = "test", max_users: int = 100, seed: int = 42) -> dict:
        self.model.require_ready()
        cases = self.data.get_evaluation_cases(split, max_users)
        if not cases:
            raise ValueError(f"No eligible {split} cases")
        ndcg, hits = 0.0, 0
        for case in cases:
            # Fixed per-user seed: reordering users does not change candidate sets.
            rng = np.random.default_rng(seed + case["user_id"])
            candidates = np.arange(1, self.data.item_count + 1, dtype=np.int32)
            eligible = np.array(
                [item for item in candidates if item not in case["seen"]],
                dtype=np.int32,
            )
            if len(eligible) < 100:
                raise ValueError("Insufficient distinct negatives for evaluation")
            negatives = rng.choice(eligible, size=100, replace=False)
            query = [case["target"], *negatives.tolist()]
            scores = self.model.score(case["history"], query)
            # Strict > assigns tied items the same best rank.
            rank = int(np.sum(scores[1:] > scores[0])) + 1
            if rank <= 10:
                hits += 1
                ndcg += 1.0 / np.log2(rank + 1)
        return {
            "split": split,
            "evaluated_users": len(cases),
            "seed": seed,
            "negative_candidates": 100,
            "sampling": "unique negatives, excluding all user interactions",
            "note": "Deterministic paper-style approximation; not bit-identical to upstream random negatives.",
            "hit_at_10": round(hits / len(cases), 5),
            "ndcg_at_10": round(ndcg / len(cases), 5),
        }
