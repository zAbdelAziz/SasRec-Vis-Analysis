from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from app.core.model_adapter import ModelNotReadyError
from app.core.analysis_data import AnalysisPrerequisite
from app.core.research_registry import is_notebook

router = APIRouter(prefix='/api')


class RunOptions(BaseModel):
    phase: Literal[1, 2] = 1
    pair: Literal['a', 'b'] = 'a'
    max_users: int = Field(default=40, ge=1, le=300)
    top_k: int = Field(default=20, ge=2, le=60)
    max_examples: int = Field(default=8, ge=1, le=30)
    seed: int = 42
    history_window: Literal[0, 10, 20, 50] = 20
    attention_layer: int = Field(default=0, ge=0)
    attention_head: int = Field(default=-1, ge=-1)


@router.get('/analyses/status')
def analyses_status(request: Request):
    engine = request.app.state.context.analysis
    return {key: engine.readiness(key) for key in sorted(engine.ALLOWED)}


@router.get('/analyses/{hypothesis}/results')
def results(request: Request, hypothesis: str, phase: int = 1, pair: str = 'a'):
    try:
        result = request.app.state.context.analysis.results(hypothesis, phase, pair)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail='No results saved for this hypothesis, phase, and pair')
    return result


@router.get('/analyses/{hypothesis}/examples/{example_id}')
def example(request: Request, hypothesis: str, example_id: str, phase: int = 1, pair: str = 'a'):
    try:
        result = request.app.state.context.analysis.results(hypothesis, phase, pair)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail='No analysis result')
    match = next((ex for ex in result['examples'] if ex['example_id'] == example_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail='No saved example for this selection')
    return match


@router.post('/analyses/{hypothesis}/run', status_code=202)
def run(request: Request, hypothesis: str, body: RunOptions):
    ctx = request.app.state.context
    try:
        ctx.analysis._validate(hypothesis, body.phase, body.pair)
        if is_notebook(hypothesis, body.phase, body.pair):
            raise AnalysisPrerequisite('Full notebook recomputation uses POST /api/research/phase1/pair-b/run with fixed notebook settings; original CSVs remain read-only.')
        readiness = ctx.analysis.readiness(hypothesis)
        if not readiness['ready']:
            raise AnalysisPrerequisite('Model, dataset or verified metadata missing: ' + str(readiness))
        params = body.model_dump(exclude={'phase', 'pair'})
        return ctx.jobs.submit(lambda progress: ctx.analysis.run(hypothesis, body.phase, body.pair,
                                                              params, progress=progress))
    except (ModelNotReadyError, AnalysisPrerequisite) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get('/jobs/{job_id}')
def job(request: Request, job_id: str):
    state = request.app.state.context.jobs.status(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail='Unknown job ID')
    return state
