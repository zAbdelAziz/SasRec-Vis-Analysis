from fastapi import APIRouter, HTTPException, Request, Query
from app.api.schemas import EvaluationRequest, RecommendationRequest
from app.core.model_adapter import ModelNotReadyError

router = APIRouter(prefix="/api")


def _context(request: Request):
    return request.app.state.context


@router.get("/health")
def health():
    return {"status": "ok", "service": "sasrec-visual-analytics"}


@router.get("/status")
def status(request: Request):
    context = _context(request)
    try:
        dataset = context.data.summary()
    except Exception as exc:
        dataset = {"ready": False, "message": str(exc)}
    return {"model": context.model.status(), "dataset": dataset, "phase": 3}


@router.get("/dataset/users/{user_id}")
def user_history(request: Request, user_id: int, split: str = "train",
                 limit: int = 30):
    if not (1 <= limit <= 200):
        raise HTTPException(status_code=422, detail="limit must be between 1 and 200")
    try:
        return _context(request).data.get_history(user_id, split=split, limit=limit)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/model/load")
def load_model(request: Request):
    try:
        return _context(request).model.load()
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/model/recommend")
def recommend(request: Request, body: RecommendationRequest):
    ctx = _context(request)
    if body.history is not None and body.user_id is not None:
        raise HTTPException(status_code=422, detail="Specify user_id OR history, not both")
    if body.history is None and body.user_id is None:
        raise HTTPException(status_code=422, detail="Provide user_id or history")
    try:
        history = body.history
        if history is None:
            history = ctx.data.get_history(body.user_id, split="test_context", limit=200)["items"]
        return ctx.model.recommend(history, body.top_k, body.exclude_seen)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/model/evaluate")
def evaluate(request: Request, body: EvaluationRequest):
    try:
        return _context(request).evaluator.evaluate(body.split, body.max_users, body.seed)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/dataset/movies")
def movie_details(request: Request, ids: str = Query("", max_length=500)):
    try:
        parsed = [int(item.strip()) for item in ids.split(",") if item.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid movie IDs") from exc
    if len(parsed) > 80 or any(item < 1 for item in parsed):
        raise HTTPException(status_code=422, detail="Request 1 to 80 positive movie IDs")
    metadata = _context(request).data.metadata
    verified = metadata.validation['state'] == 'verified'
    return {"verified": verified, "items": metadata.movie_details(parsed) if verified else []}
