# files/root-and-config.md — Root files, scripts, data, legacy app

> Covers: `README.md`, `Makefile`, `.gitignore`, `.env`, `scripts/dev.sh`,
> `data/benchmark/intro.txt`, `data/vector_stores/`, `RAG_app.py`, `RAG_notebook.ipynb`.

---

## `README.md`

### Purpose
Top-level description + run instructions + phase status for the whole project.

### Why it exists
Give a new developer the structure, the setup commands, the endpoint table, and the
project's roadmap (phases 1-4).

### Imports / Exports
None (Markdown).

### Beginner explanation
The conventional "read me first" file. It documents `make setup`, `make db`,
`make superuser`, `make dev`, the endpoint table, and phase status.

### Modification guide
Update when the project's structure, endpoints, setup flow, or roadmap changes.

---

## `Makefile`

### Purpose
Central dev-command hub. Wraps venv/uvicorn/npm/Django-admin commands.

### Why it exists
Make the typical workflow one word: `make dev`, `make db`, `make superuser`.

### Important targets (all verified)

| Target | Command it runs | Purpose |
| ------ | --------------- | ------- |
| `setup` | `setup-backend` + `setup-frontend` | Create venv, pip install, npm install |
| `setup-backend` | `python3 -m venv venv`; `pip install -r backend/requirements.txt` | Backend deps |
| `setup-frontend` | `npm --prefix frontend install` | Frontend deps |
| `makemigrations` | `python manage.py makemigrations` (in `backend/`) | Generate Django migrations |
| `migrate` / `db` | `python manage.py migrate` (in `backend/`) | Apply migrations |
| `superuser` | `python manage.py createsuperuser` | Create Django admin user |
| `backend` | `uvicorn config.asgi:application --reload` (in `backend/`) | Run backend on :8000 |
| `frontend` | `npm --prefix frontend run dev` | Run frontend on :5173 |
| `dev` | `./scripts/dev.sh` | Run both together |
| `stop` | kills processes on ports 8000/5173 | Stop dev servers |

### Beginner explanation
A Makefile maps short names to longer shell commands. All paths assume the repo-root
`venv/`.

### Modification guide
Add a target when you want a new one-word command (e.g. `make test`, `make lint`).
**Note:** there is currently **no** `test` target.

---

## `.gitignore`

### Purpose
Prevents secrets, venvs, node_modules, runtime DBs, Chroma stores, build output, and
session transcripts from being committed.

### Important rules (verified)
- `.env` — local secrets ignored.
- `venv/`, `*.pyc`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/` — Python artifacts.
- `node_modules/`, `frontend/dist/` — Node artifacts.
- `data/vector_stores/`, `path_to_db/` — vector DB data.
- `backend/db.sqlite3`, `backend/storage/`, `backend/staticfiles/` — runtime artifacts.
- `session-*.md` — AI-session transcripts.

### Modification guide
Add entries as new runtime/large/secret artifacts appear.
**Verified quirk:** since `data/vector_stores/` and `data/tmp/` are gitignored, a fresh
clone has no Chroma data and no benchmark corpus locally — run `make backend` first to
let `core/models.py:141-143` recreate the directories automatically at import time.

---

## `.env`

### Purpose / content
Local secrets consumed by `backend/config/settings.py` via `python-dotenv`
(`load_dotenv(PROJECT_ROOT / ".env")`, settings.py:21).

### Variable names present (verified; values not reproduced)
| Variable | Used as | Currently set |
| -------- | ------- | ------------- |
| `GEMINI_API` | `API_KEYS["gemini"]` **and** `API_KEYS["google"]` | yes |
| `COHERE_API` | `API_KEYS["cohere"]` | yes |
| `OPENAI_API` | `API_KEYS["openai"]` | **no** — falls back to `""` |
| `HF_API` | `API_KEYS["huggingface"]` | **no** — falls back to `""` |
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Django settings | optional; defaults exist in `settings.py` |

### Beginner explanation
`.env` holds API keys that must never be committed. The backend reads it at startup.
Only Google/Gemini and Cohere keys are configured in the current local `.env`, so
OpenAI and HuggingFace pipelines will fail with unset keys.

### Modification guide
Only edit to add/rotate keys. Never commit.

---

## `scripts/dev.sh`

### Purpose
Start the backend and frontend together and clean up on exit.

### Imports / key logic (verified)
- `set -euo pipefail`.
- Backend: ``"$ROOT/venv/bin/uvicorn" config.asgi:application --host 127.0.0.1 --port 8000``
  run **from `backend/`**.
- Frontend: `npm run dev -- --port 5173` run from `frontend/`.
- `trap ... cleanup` kills both PIDs on `EXIT`/`INT`/`TERM`. `wait` blocks on the frontend.

### Beginner explanation
The single command behind `make dev`. It runs the FastAPI+Django monolith and the Vite
server, kills both when you Ctrl-C.

### Modification guide
Edit if ports, host binding, or process management need to change for your environment.

---

## `data/benchmark/intro.txt`

### Purpose
Fixed corpus text used by the benchmark harness (`BENCHMARK_CORPUS_DIR =
PROJECT_ROOT / "data" / "benchmark"` in `settings.py`). It is the only ingested document
for benchmark runs.

### Why it exists
Benchmarks must compare variants against the *same* documents; this file is that corpus.

### Modification guide
Replace the sample text if you want benchmarks to run against your own short corpus.
Both benchmark questions in `settings.py` (`BENCHMARK_QUESTIONS`) are answerable from
this file.

---

## `data/vector_stores/`

### Purpose / content
Root directory holding one Chroma store per vectorstore
(`<name>/chroma.sqlite3` + HNSW `.bin` files). Shared with the legacy `RAG_app.py`
("Open a saved Vectorstore" tab scans this same directory).

### Modification guide
Usually no manual edits. Deleting a directory deletes that knowledge base's embeddings.
Records in Django's `VectorStore` table can then point at a missing store.

---

## `RAG_app.py` (legacy Streamlit app — reference only)

> **Status:** NOT part of the running application. The `backend/rag` engine is the
> modular replacement ported from this file. Verified, each old function maps to a new
> component (see table below).

### Purpose
Single-file Streamlit prototype: sidebar (LLM provider, API key input, model,
temperature/top_p, response language, retriever type) + two tabs (create/open a
vectorstore) + chat UI using `ConversationalRetrievalChain`.

### Architecture
Everything lives in `st.session_state`; there is no DB, no API. `if __name__ ==
"__main__": chatbot()` runs the main loop.

### Pipeline (legacy)
1. **Ingestion** (`chain_RAG_blocks`): validate → clear `data/tmp` → save uploads →
   `langchain_document_loader()` (`DirectoryLoader` per ext) →
   `split_documents_to_chunks()` (`RecursiveCharacterTextSplitter(1600, 200)`) →
   `select_embeddings_model()` (OpenAI / Google / HF) → `Chroma.from_documents` → build
   retriever → build chain.
2. **Chat** (`get_response_from_LLM`): `chain.invoke({"question": ...})`; strips the
   `"\nAnswer: "` prefix for HF; renders sources in an expander.

### Function → new-module mapping (verified by line-level comparison)

| Legacy function (`RAG_app.py`) | New home (`backend/rag/`) |
| ------------------------------ | ------------------------- |
| `langchain_document_loader` | `loaders/directory_loader.py` |
| `split_documents_to_chunks` | `splitters/recursive.py` |
| `select_embeddings_model` | `embeddings/openai.py`, `google.py`, `huggingface.py` |
| `Vectorstore_backed_retriever` | `retrievers/base.py` |
| `create_compression_retriever` | `retrievers/contextual_compression.py` (+ `splitters/character.py`) |
| `CohereRerank_retriever` | `retrievers/cohere_rerank.py` |
| `create_retriever` (dispatch) | `services/retrieval.py::build_retriever` |
| `create_memory` | `memory/buffer.py`, `memory/summary.py` |
| `answer_template` | `prompts/answer.py` |
| condense-question prompt | `prompts/condense.py` |
| `create_ConversationalRetrievalChain` | `chains/conversational.py` |
| `chain_RAG_blocks` orchestration | `services/ingestion.py::ingest_documents` |
| `get_response_from_LLM` | `services/execution.py::execute_pipeline` |

### Notable legacy constant deltas (verified)
- Cohere rerank model: legacy `rerank-multilingual-v2.0` → new `rerank-multilingual-v3.0`.
- Legacy base retriever `k=4` while `create_retriever` uses `base_retriever_k=16`; the
  new code consistently uses `k=16`.

### Modification guide
Do **not** modify for new features — it is deprecated reference. Edit only if you need to
change the historical behavior docs.

---

## `RAG_notebook.ipynb`

### Purpose
Large legacy Jupyter notebook (history/experiments). Not part of the runtime. Documented
for completeness only — treat as historical reference.

### Modification guide
None expected.

---

## `path_to_db/` and `backend/storage/`

- `path_to_db/chroma.sqlite3` — a stray/duplicate Chroma DB copy; gitignored, not
  referenced by `settings.py` or runtime code. `UNKNOWN what produced it`.
- `backend/storage/` — `STORAGE_DIR` (`settings.py:115`). Contains `tmp/` used for
  staging uploads and benchmark scratch Chroma stores (e.g.
  `tmp/bench_run_<id>_<i>/chroma.sqlite3`). Created automatically
  (`core/models.py:141-143`).