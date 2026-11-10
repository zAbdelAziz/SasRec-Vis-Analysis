"""Source-preserving API for Pair B's original notebook research."""
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from app.core.research_registry import manifest as availability

router = APIRouter(prefix='/api/research')


def source(request: Request):
    return request.app.state.context.analysis.notebook


@router.get('/availability')
def available_hypotheses():
    return availability()


@router.get('/phase1/pair-b/manifest')
def notebook_manifest(request: Request):
    return source(request).manifest()


@router.get('/phase1/pair-b/notebook/notes')
def notebook_notes(request: Request):
    notebook = source(request)
    if not notebook.available:
        raise HTTPException(status_code=404, detail='Original notebook files are missing')
    return {'source': 'research/phase1/ai_pair/phase1_behavior_analysis.ipynb',
            'cells': notebook.notebook_cells()}


@router.get('/phase1/pair-b/prompts')
def notebook_prompts(request: Request):
    notebook = source(request)
    if not notebook.available:
        raise HTTPException(status_code=404, detail='Original notebook files are missing')
    return {'source': 'research/phase1/ai_pair/AI_interaction_record_phase1.md',
            'markdown': notebook.prompts()}


@router.get('/phase1/pair-b/tables/{table}')
def notebook_table(request: Request, table: str, offset: int = Query(0, ge=0),
                   limit: int = Query(100, ge=1, le=500),
                   user_id: int | None = Query(None, ge=1), genre: str | None = None):
    try:
        return source(request).table(table, offset=offset, limit=limit,
                                     user_id=user_id, genre=genre)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get('/phase1/pair-b/figures/{filename}')
def notebook_figure(request: Request, filename: str):
    notebook = source(request)
    if filename not in notebook.manifest().get('figures', []):
        raise HTTPException(status_code=404, detail='Unknown notebook figure')
    return FileResponse(notebook.outputs / filename, media_type='image/png')


@router.get('/phase1/pair-b/audit/{hypothesis}')
def audit_notebook_results(request: Request, hypothesis: str):
    try:
        return source(request).audit(hypothesis)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.get('/phase1/pair-b/users/{hypothesis}/{user_id}')
def notebook_user_detail(request: Request, hypothesis: str, user_id: int,
                         run_id: str | None = None):
    from app.core.notebook_results import NotebookResearch
    try:
        notebook = NotebookResearch(source(request).project_root, run_id=run_id) if run_id else source(request)
        if not notebook.available:
            raise HTTPException(status_code=404, detail='Notebook run or source data is unavailable')
        return notebook.user_detail(hypothesis, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get('/phase1/pair-b/run/readiness')
def notebook_run_readiness(request: Request):
    from app.core.notebook_runner import NotebookPipeline
    return NotebookPipeline(source(request).project_root).readiness()


@router.post('/phase1/pair-b/run', status_code=202)
def notebook_full_run(request: Request):
    from app.core.notebook_runner import NotebookPipeline
    pipeline = NotebookPipeline(source(request).project_root)
    state = pipeline.readiness()
    if not state['ready']:
        raise HTTPException(status_code=409, detail='Full notebook rerun prerequisites missing: ' + ', '.join(state['missing_files']))
    return request.app.state.context.jobs.submit(lambda progress: pipeline.run(progress=progress))


@router.get('/phase1/pair-b/runs/{run_id}/results/{hypothesis}')
def notebook_generated_results(request: Request, run_id: str, hypothesis: str):
    from app.core.notebook_results import NotebookResearch
    try:
        notebook = NotebookResearch(source(request).project_root, run_id=run_id)
        if not notebook.available:
            raise HTTPException(status_code=404, detail='No generated notebook run for this ID')
        return notebook.result(hypothesis)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
