from typing import Literal
from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    user_id: int | None = Field(default=None, ge=1)
    history: list[int] | None = None
    top_k: int = Field(default=20, ge=1, le=100)
    exclude_seen: bool = True


class EvaluationRequest(BaseModel):
    split: Literal["test", "validation"] = "validation"
    max_users: int = Field(default=100, ge=1, le=500)
    seed: int = Field(default=42, ge=0, le=1_000_000)
