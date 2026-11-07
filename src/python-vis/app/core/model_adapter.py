"""Load the unmodified upstream SASRec model only when weights exist."""
import importlib.util
import hashlib
from argparse import Namespace
from pathlib import Path
from threading import Lock
import numpy as np
from app.config import Settings
from app.core.data_repository import DataRepository


class ModelNotReadyError(RuntimeError):
    pass


class SASRecAdapter:
    DEFAULTS = {
        "maxlen": 200, "hidden_units": 50, "num_blocks": 2,
        "num_heads": 1, "dropout_rate": 0.2, "norm_first": False,
    }

    def __init__(self, settings: Settings, data: DataRepository):
        self.settings = settings
        self.data = data
        self.model = None
        self.checkpoint_loaded: Path | None = None
        self.config: dict = {}
        self.checkpoint_sha256: str | None = None
        self.error: str | None = None
        self.warnings: list[str] = []
        self._autoload_lock = Lock()
        self._autoload_stamp: tuple | None = None
        self._loaded_stat: tuple[int, int] | None = None

    def _try_autoload(self) -> None:
        """Load a new local checkpoint once, never requiring a manual UI click.

        A failed/incomplete file is retried only if it changes on disk.
        """
        if self.model is not None:
            return
        checkpoint = self.settings.checkpoint_path()
        if not checkpoint or not (self.settings.model_python / "model.py").is_file() or not self.data.available:
            return
        if not self._autoload_lock.acquire(blocking=False):
            return
        try:
            try:
                stat = checkpoint.stat()
            except OSError:
                return
            stamp = (str(checkpoint), stat.st_size, stat.st_mtime_ns)
            if stamp == self._autoload_stamp:
                return
            self._autoload_stamp = stamp
            try:
                self.load()
            except (ModelNotReadyError, OSError) as exc:
                # status() communicates the error; the API must stay available.
                self.error = str(exc)
        finally:
            self._autoload_lock.release()

    def status(self) -> dict:
        self._try_autoload()
        checkpoint = self.checkpoint_loaded if self.model is not None else self.settings.checkpoint_path()
        return {
            "ready": self.model is not None,
            "upstream_installed": (self.settings.model_python / "model.py").is_file(),
            "checkpoint_found": checkpoint is not None,
            "checkpoint": str(checkpoint) if checkpoint else None,
            "checkpoint_sha256": self.checkpoint_sha256,
            "device": self.settings.device,
            "configuration": self.config if self.model is not None else None,
            "error": self.error,
            "warnings": self.warnings,
            "message": self._status_message(checkpoint),
        }

    def _status_message(self, checkpoint: Path | None) -> str:
        if self.model is not None:
            return "Checkpoint loaded in memory (training can continue independently)"
        if not (self.settings.model_python / "model.py").is_file():
            return "Clone the unchanged upstream repository with npm run setup:model"
        if self.settings.checkpoint_ambiguity:
            return "Multiple checkpoints found; set SASREC_CHECKPOINT explicitly"
        if self.settings.checkpoint_override and not checkpoint:
            return f"Configured checkpoint does not exist: {self.settings.checkpoint_override}"
        if not checkpoint:
            return "Awaiting checkpoint at artifacts/checkpoints/SASREC_CHECKPOINT.pth"
        if self.error:
            return "Checkpoint detected but could not be loaded; see the error below"
        return "Checkpoint found; attempting automatic loading"

    def _training_config(self, checkpoint: Path) -> tuple[dict, bool]:
        config = dict(self.DEFAULTS)
        args_path = checkpoint.parent / "args.txt"
        if not args_path.is_file() and checkpoint == self.settings.canonical_checkpoint:
            # Use upstream run settings if there is exactly one source run.
            matches = list(self.settings.model_python.glob("ml-1m_*/args.txt"))
            if len(matches) == 1:
                args_path = matches[0]
        if not args_path.is_file():
            return config, False
        for line in args_path.read_text(encoding="utf-8").splitlines():
            if "," not in line:
                continue
            key, value = line.split(",", 1)
            if key in {"maxlen", "hidden_units", "num_blocks", "num_heads"}:
                config[key] = int(value)
            elif key == "dropout_rate":
                config[key] = float(value)
            elif key == "norm_first":
                config[key] = value.strip().lower() in {"true", "1"}
        return config, True

    def load(self) -> dict:
        checkpoint = self.settings.checkpoint_path()
        if checkpoint is None and self.model is not None:
            # Training may have created additional checkpoints after this one
            # was loaded. Keep the in-memory model usable without reselecting.
            return self.status()
        self.warnings = []
        self.error = None
        if checkpoint is None:
            raise ModelNotReadyError(self._status_message(checkpoint))
        model_file = self.settings.model_python / "model.py"
        if not model_file.is_file():
            raise ModelNotReadyError(f"Upstream model missing: {model_file}")
        if not self.data.available:
            raise ModelNotReadyError("Processed interaction data is not installed")
        try:
            current_stat = checkpoint.stat()
        except OSError as exc:
            raise ModelNotReadyError(f"Checkpoint disappeared or is inaccessible: {exc}") from exc
        file_version = (current_stat.st_size, current_stat.st_mtime_ns)
        if (self.model is not None and checkpoint == self.checkpoint_loaded and
                file_version == self._loaded_stat):
            return self.status()
        try:
            import torch
            settings, has_args = self._training_config(checkpoint)
            if not has_args:
                self.warnings.append(
                    "args.txt missing beside checkpoint; architecture defaults assumed. "
                    "Verify norm_first and all training parameters."
                )
            if self.settings.device.startswith("cuda") and not torch.cuda.is_available():
                raise ModelNotReadyError("CUDA requested but unavailable. Use SASREC_DEVICE=cpu")
            spec = importlib.util.spec_from_file_location("upstream_sasrec_model", model_file)
            if spec is None or spec.loader is None:
                raise ModelNotReadyError("Could not import original SASRec model.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            args = Namespace(**settings, device=self.settings.device)
            network = module.SASRec(self.data.user_count, self.data.item_count, args)
            # Only load local, trusted weights. Current PyTorch supports weights_only.
            state = torch.load(checkpoint, map_location="cpu", weights_only=True)
            network.load_state_dict(state, strict=True)
            network.to(self.settings.device).eval()
            self.model = network
            self.checkpoint_loaded = checkpoint
            self.config = settings
            self.checkpoint_sha256 = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
            self._loaded_stat = file_version
        except Exception as exc:
            self.model = None
            self.checkpoint_loaded = None
            self.checkpoint_sha256 = None
            self._loaded_stat = None
            self.error = str(exc)
            if isinstance(exc, ModelNotReadyError):
                raise
            raise ModelNotReadyError(f"Failed to load compatible checkpoint: {exc}") from exc
        return self.status()

    def require_ready(self):
        self._try_autoload()
        if self.model is None:
            raise ModelNotReadyError("Model not loaded. Train locally, then call POST /api/model/load")
        return self.model

    def score_many(self, histories: list[list[int]], candidate_ids: list[int],
                   batch_size: int = 6) -> np.ndarray:
        """Score multiple histories on the same candidates, limiting inference memory.

        The upstream SASRec implementation expects NumPy sequence arrays because
        log2feats() mixes NumPy positional operations and PyTorch embeddings.
        """
        network = self.require_ready()
        if not histories or not candidate_ids:
            raise ValueError("At least one history and one candidate are required")
        if batch_size < 1 or batch_size > 32:
            raise ValueError("batch_size must be between 1 and 32")
        limit = self.data.item_count
        if any(not history for history in histories):
            raise ValueError("Histories must not be empty")
        if any(not 1 <= int(item) <= limit for history in histories for item in history):
            raise ValueError("History contains out-of-range internal item IDs")
        if any(not 1 <= int(item) <= limit for item in candidate_ids):
            raise ValueError("Candidates contain out-of-range internal item IDs")
        import torch
        candidates = np.asarray(candidate_ids, dtype=np.int64)
        maxlen = int(self.config["maxlen"])
        batches = []
        with torch.inference_mode():
            for offset in range(0, len(histories), batch_size):
                group = histories[offset:offset + batch_size]
                sequences = np.zeros((len(group), maxlen), dtype=np.int64)
                for row, history in enumerate(group):
                    trimmed = history[-maxlen:]
                    sequences[row, -len(trimmed):] = trimmed
                logits = network.predict(np.zeros(len(group), dtype=np.int64),
                                         sequences, candidates)
                scores = logits.detach().cpu().numpy()
                batches.append(np.asarray(scores, dtype=np.float32).reshape(len(group), -1))
        result = np.concatenate(batches, axis=0)
        if result.shape[1] != len(candidates):
            raise ValueError("Model returned an unexpected number of candidate scores")
        return result

    def score(self, history: list[int], candidate_ids: list[int]) -> np.ndarray:
        return self.score_many([history], candidate_ids)[0]

    def recommend(self, history: list[int], top_k: int = 20,
                  exclude_seen: bool = True) -> dict:
        self.require_ready()
        if not 1 <= top_k <= 100:
            raise ValueError("top_k must be between 1 and 100")
        seen = set(history) if exclude_seen else set()
        candidates = [i for i in range(1, self.data.item_count + 1) if i not in seen]
        if not candidates:
            raise ValueError("No eligible recommendation candidates")
        scores = self.score(history, candidates)
        best = np.argsort(-scores, kind="stable")[:top_k]
        return {
            "history_length": len(history),
            "candidate_count": len(candidates),
            "items": [
                {"rank": rank, "item_id": candidates[int(index)],
                 "score": float(scores[index])}
                for rank, index in enumerate(best, start=1)
            ],
            "score_type": "raw_logit_not_probability",
            "id_space": "sasrec_internal",
        }
