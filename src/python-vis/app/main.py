"""FastAPI entrypoint for the visualization foundation."""
from dataclasses import dataclass
from fastapi import FastAPI
from app.config import Settings
from app.api.routes import router
from app.api.analysis_routes import router as analysis_router
from app.api.research_routes import router as research_router
from app.core.analysis_engine import AnalysisEngine
from app.core.job_manager import JobManager
from app.core.data_repository import DataRepository
from app.core.model_adapter import SASRecAdapter
from app.core.evaluator import BenchmarkEvaluator


@dataclass
class ApplicationContext:
    data: DataRepository
    model: SASRecAdapter
    evaluator: BenchmarkEvaluator
    analysis: AnalysisEngine
    jobs: JobManager


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_environment()
    data = DataRepository(config)
    model = SASRecAdapter(config, data)
    application = FastAPI(title="SASRec Visual Analytics API", version="0.4.0")
    application.state.context = ApplicationContext(data=data, model=model, evaluator=BenchmarkEvaluator(data, model), analysis=AnalysisEngine(data, model), jobs=JobManager())
    application.include_router(router)
    application.include_router(analysis_router)
    application.include_router(research_router)
    return application


app = create_app()
