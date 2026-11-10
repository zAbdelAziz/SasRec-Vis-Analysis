from dataclasses import replace
from pathlib import Path
import shutil
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.api.research_routes import router
from app.core.notebook_results import NotebookResearch


ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def research(tmp_path):
    folder = tmp_path / 'research/phase1/ai_pair'
    folder.mkdir(parents=True)
    reference = ROOT / 'research/phase1/ai_pair'
    shutil.copytree(reference / 'outputs', folder / 'outputs')
    shutil.copyfile(reference / 'phase1_behavior_analysis.ipynb', folder / 'phase1_behavior_analysis.ipynb')
    prompts = tmp_path / 'ai-interactions'
    prompts.mkdir()
    shutil.copyfile(ROOT / 'ai-interactions/phase1_ai_pair.md', prompts / 'phase1_ai_pair.md')
    return NotebookResearch(tmp_path)


@pytest.fixture
def client(research):
    app = FastAPI()
    app.state.context = SimpleNamespace(analysis=SimpleNamespace(notebook=research))
    app.include_router(router)
    return TestClient(app)


@pytest.mark.parametrize('hypothesis', ['h1', 'h4', 'h5'])
def test_saved_results_do_not_require_research_documents(research, hypothesis):
    research.notebook_path.unlink()
    research.prompts_path.unlink()
    result = research.result(hypothesis)
    assert result['status'] == 'complete'
    assert result['n_records'] == 6040
    assert len(result['views']) > 1
    assert research.manifest()['available']


def test_notes_and_prompts_load_from_current_repository_paths(client, research):
    response = client.get('/api/research/phase1/pair-b/notebook/notes')
    assert response.status_code == 200
    assert response.json()['cells']
    response = client.get('/api/research/phase1/pair-b/prompts')
    assert response.status_code == 200
    assert response.json()['source'] == 'ai-interactions/phase1_ai_pair.md'
    assert response.json()['markdown'] == research.prompts()
    assert research.manifest()['prompts'] == response.json()['source']


def test_documents_load_without_saved_exports(client, research):
    shutil.rmtree(research.outputs)
    assert not research.available
    assert client.get('/api/research/phase1/pair-b/notebook/notes').status_code == 200
    assert client.get('/api/research/phase1/pair-b/prompts').status_code == 200


def test_missing_documents_have_independent_errors(client, research):
    research.prompts_path.unlink()
    response = client.get('/api/research/phase1/pair-b/prompts')
    assert response.status_code == 404
    assert response.json()['detail'] == 'Phase I prompt record is missing'
    assert client.get('/api/research/phase1/pair-b/notebook/notes').status_code == 200
    research.notebook_path.unlink()
    assert client.get('/api/research/phase1/pair-b/notebook/notes').status_code == 404
    assert research.available


def test_fresh_install_api_without_model_or_generated_runs(research, monkeypatch, tmp_path):
    from app.config import Settings
    from app.main import create_app

    # Launch from an unrelated working directory, with spaces and Unicode in
    # the installation path, and no model, raw data, or local generated runs.
    relocated = tmp_path / 'fresh checkout café'
    relocated.mkdir()
    for name in ('research', 'ai-interactions'):
        shutil.move(str(tmp_path / name), str(relocated / name))
    monkeypatch.chdir(tmp_path)
    settings = replace(
        Settings.from_environment(),
        project_root=relocated,
        model_python=relocated / 'src/model/SASRec.pytorch/python',
        interactions=relocated / 'missing-interactions.txt',
        raw_movielens=relocated / 'src/data/raw/ml-1m',
        artifacts=relocated / 'src/data/artifacts',
        checkpoint_override=None,
    )
    with TestClient(create_app(settings)) as client:
        for hypothesis in ('h1', 'h4', 'h5'):
            response = client.get(f'/api/analyses/{hypothesis}/results?phase=1&pair=b')
            assert response.status_code == 200, response.text
            assert response.json()['n_records'] == 6040
            response = client.get(f'/api/research/phase1/pair-b/users/{hypothesis}/1')
            assert response.status_code == 200, response.text
        prefix = '/api/research/phase1/pair-b'
        for route in ('manifest', 'notebook/notes', 'prompts', 'tables/genre_share_summary'):
            response = client.get(f'{prefix}/{route}')
            assert response.status_code == 200, response.text
        response = client.get(f'{prefix}/figures/genre_share_change.png')
        assert response.status_code == 200
        assert response.headers['content-type'] == 'image/png'
        assert client.get(f'{prefix}/run/readiness').json()['ready'] is False
        assert client.post(f'{prefix}/run').status_code == 409


def test_default_root_is_independent_of_working_directory(monkeypatch, tmp_path):
    from app.config import Settings

    monkeypatch.chdir(tmp_path)
    assert Settings.from_environment().project_root == ROOT
