# SASRec Visual Analytics - H1, H2, H3

React + FastAPI visual analytics for MovieLens-1M and a trained SASRec checkpoint. There are **three active hypotheses** (`h1`, `h2`, `h3`), each with a behavioral **research Phase I** and an internal-model **research Phase II**. The application never fabricates model outputs to fill missing results.

## Course project context

The model is SASRec, used for next-item prediction on the MovieLens-1M interaction dataset. Phase I investigates observable recommendation behavior; Phase II examines the model's learned representations and attention. The AI-assisted pair's Phase I analysis and interaction record are in `research/phase1/ai_pair/` and `ai-interactions/`, respectively.

## Quick setup

Requires Python 3.11+, Node.js 22+, Git, a compatible SASRec checkpoint, the original processed interaction data, and verified MovieLens mapping/metadata. From the repository root:

```bash
npm install
npm run setup:model            # upstream SASRec source, unmodified
npm run setup:ui
python -m venv .venv
source .venv/bin/activate
python -m pip install -r src/python-vis/requirements.txt
npm run setup:data             # download MovieLens and ID mapping, then verify
npm run dev
```

Open `http://localhost:5173`. The API is at `http://localhost:8000/docs`. For the supplied checkpoint, the canonical path is `artifacts/checkpoints/SASREC_CHECKPOINT.pth`, with its matching `args.txt`. The checkpoint is **not retrained** by this application. The ZIP includes this checkpoint and compatible cached H1/H2 research Phase II and H1/H2/H3 research Phase I results; it does not include upstream model source or raw MovieLens files.

## Investigations

| Hypothesis | Research Phase I: observable recommendations | Research Phase II: learned internals |
|---|---|---|
| **H1** (`h1`) | Historical vs recommended genre shares | Distance-matched shared-genre attention; directional non-self genre-pair attention; chronological example |
| **H2** (`h2`) | Mean release-year shifts, and decade mixes for history/recommendations/catalog | Cosine alignment of final contextual user state with candidate movie embeddings by decade; candidate-weighted ranking-score advantage |
| **H3** (`h3`) | Genre amplification by age and gender | Post-hoc genre reference alignment from learned vectors; actual final-query causal attention to historical genres; age/gender user-level bootstrap intervals; linked, same-cohort Phase I comparison. |

## Using the app

Choose a hypothesis and research phase. Pair A and Pair B are independent result namespaces; defaults use random seeds **42** and **1042**. Both research phases use verified item mappings and metadata. The full-width pages prioritize coordinated charts; run/reload controls and an always-visible methodology panel are at the bottom. Missing Pair B results are shown as missing, not copied from Pair A.

Different seeds do **not** establish independent human-only/AI-aided workflows for the course; keep the separate process and AI-use documentation required by the assignment.
