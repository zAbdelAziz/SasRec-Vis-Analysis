"""Paths and settings for the analysis app. No training takes place here."""
from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    project_root: Path
    model_python: Path
    interactions: Path
    raw_movielens: Path
    artifacts: Path
    checkpoint_override: Path | None
    device: str = "cpu"

    @classmethod
    def from_environment(cls) -> "Settings":
        root = Path(__file__).resolve().parents[3]
        model_python = root / "src/model/SASRec.pytorch/python"
        configured_data = os.getenv("SASREC_DATA_PATH")
        configured_checkpoint = os.getenv("SASREC_CHECKPOINT")
        return cls(project_root=root, model_python=model_python,
                   interactions=Path(configured_data).expanduser().resolve() if configured_data else model_python / "data/ml-1m.txt",
                   raw_movielens=root / "src/data/raw/ml-1m", artifacts=root / "src/data/artifacts",
                   checkpoint_override=Path(configured_checkpoint).expanduser().resolve() if configured_checkpoint else None,
                   device=os.getenv("SASREC_DEVICE", "cpu"))

    @property
    def canonical_checkpoint(self) -> Path:
        """Stable location relative to the project root, independent of training."""
        return self.project_root / "artifacts/checkpoints/SASREC_CHECKPOINT.pth"

    def checkpoint_path(self) -> Path | None:
        if self.checkpoint_override:
            return self.checkpoint_override if self.checkpoint_override.is_file() else None
        if self.canonical_checkpoint.is_file():
            return self.canonical_checkpoint
        candidates = self._checkpoint_candidates()
        # Keep old one-checkpoint setups working, but never choose among epochs.
        return candidates[0] if len(candidates) == 1 else None

    def _checkpoint_candidates(self) -> list[Path]:
        local = list((self.artifacts / "checkpoints").glob("*.pth"))
        trained = list(self.model_python.glob("ml-1m_*/SASRec*.pth"))
        return sorted(set(local + trained))

    @property
    def checkpoint_ambiguity(self) -> bool:
        return (self.checkpoint_override is None and
                not self.canonical_checkpoint.is_file() and
                len(self._checkpoint_candidates()) > 1)
