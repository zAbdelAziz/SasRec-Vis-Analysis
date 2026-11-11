# SASRec Visual Analytics - Cosmic Mirage Group

React + FastAPI visual analytics for MovieLens-1M and a trained SASRec checkpoint. Pair A covers `h1`, `h2`, and `h3` in behavioral **research Phase I** and internal-model **research Phase II**. Pair B covers `h1`, `h4`, and `h5` in Phase I. The application never fabricates model outputs to fill missing results.

## Course project context

The model is SASRec, used for next-item prediction on the MovieLens-1M interaction dataset. Phase I investigates observable recommendation behavior; Phase II examines the model's learned representations and attention. The AI-assisted pair's Phase I analysis and interaction record are in `research/phase1/ai_pair/` and `ai-interactions/`, respectively.

## Quick setup

Use Python 3.11–3.14 and Node.js 22.12 or later in the Node 22 series. Run commands from the repository root. The repository must include `research/phase1/ai_pair/` and `ai-interactions/phase1_ai_pair.md`; these contain the saved Pair B results and documents.

Create and activate a Python environment:

```bash
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows PowerShell (instead of the line above):
.venv\Scripts\Activate.ps1
```

Then install the dependencies and start the app:

```bash
python -m pip install -r src/python-vis/requirements.txt
npm ci
npm ci --prefix src/ui
npm run dev
```

**Viewing saved H1 Pair B, H4, and H5 results needs no model download, raw MovieLens data, or generated application runs.** Notes and prompts load independently of saved results. Keep both npm lockfiles in a checkout or distribution so `npm ci` can reproduce the JavaScript dependencies.

For model inference or a full-cohort rerun, also install the upstream source and data (Git and internet access required):

```bash
npm run setup:model            # run once; skip if this clone already exists
npm run setup:data             # download MovieLens and ID mapping, then verify
```

The matching checkpoint and `args.txt` must be present as described below. The full-cohort run button reports missing prerequisites; it is separate from loading saved results.

Open `http://localhost:5173`. The API is at `http://localhost:8000/docs`. For the supplied checkpoint, the canonical path is `artifacts/checkpoints/SASREC_CHECKPOINT.pth`, with its matching `args.txt`. The checkpoint is **not retrained** by this application. The ZIP includes this checkpoint and compatible cached H1/H2 research Phase II and H1/H2/H3 research Phase I results; it does not include upstream model source or raw MovieLens files.

## Investigations

| Hypothesis | Research Phase I: observable recommendations | Research Phase II: learned internals |
|---|---|---|
| **H1** (`h1`) | Historical vs recommended genre shares | Distance-matched shared-genre attention; directional non-self genre-pair attention; chronological example |
| **H2** (`h2`) | Mean release-year shifts, and decade mixes for history/recommendations/catalog | Cosine alignment of final contextual user state with candidate movie embeddings by decade; candidate-weighted ranking-score advantage |
| **H3** (`h3`) | Genre amplification by age and gender | Post-hoc genre reference alignment from learned vectors; actual final-query causal attention to historical genres; age/gender user-level bootstrap intervals; linked, same-cohort Phase I comparison. |
| **H4** (`4`) | Popularity exposure |  |
| **H4** (`5`) | Timestep order sensitivity |  |

## Using the app

Choose a hypothesis and research phase. Pair A and Pair B are independent result namespaces; defaults use random seeds **42** and **1042**. Both research phases use verified item mappings and metadata. The full-width pages prioritize coordinated charts; run/reload controls and an always-visible methodology panel are at the bottom. Missing Pair B results are shown as missing, not copied from Pair A.

Different seeds do **not** establish independent human-only/AI-aided workflows for the course; keep the separate process and AI-use documentation required by the assignment.

## Installation checks

With the Python environment activated:

```bash
python -m pip check
npm run test:python
npm run build
```

The local tests cover saved Pair B results, user details, figures, notes, and prompts without model assets or generated runs, including an installation path with spaces and Unicode. Full model reruns require the separate assets above and are not exercised by these tests.
