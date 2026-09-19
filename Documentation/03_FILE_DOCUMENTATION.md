# 03 — File Documentation (index)

> Per-file documentation for every source/configuration file that materially
> contributes to the application. Because the full documentation is very long, it is
> split into five files under `files/`. This page is the index + the priority list.

## Priority classifications

| Class | Meaning | Start where |
| ----- | ------- | ----------- |
| **CORE** | Critical to understanding the application. Read first. | — |
| **IMPORTANT** | Frequently involved in development. | — |
| **SUPPORTING** | Useful but not essential initially. | — |
| **GENERATED / CONFIG** | Usually not manually modified. | — |
| **LOW PRIORITY** | Can be understood later. | — |

## File → documentation map

### Root and config files → `files/root-and-config.md`

| File | Priority | One-line role |
| ---- | -------- | ------------- |
| `README.md` | GENERATED / CONFIG | Project readme, run instructions, phase status |
| `Makefile` | IMPORTANT | Dev commands: setup, db, backend, frontend, dev, stop |
| `.gitignore` | GENERATED / CONFIG | Ignore rules |
| `.env` | GENERATED / CONFIG | Local secrets (only `GEMINI_API`, `COHERE_API`) |
| `scripts/dev.sh` | IMPORTANT | Runs backend (uvicorn) + frontend (Vite) together |
| `data/benchmark/intro.txt` | SUPPORTING | Fixed benchmark corpus |
| `data/vector_stores/` | GENERATED / CONFIG | Chroma stores (runtime data) |
| `RAG_app.py` | IMPORTANT* | Legacy Streamlit app — reference source for the port |
| `RAG_notebook.ipynb` | LOW PRIORITY | Legacy notebook, not part of runtime |

\* Legacy reference, not part of the running application.

### Django project + core app → `files/backend-config-core.md`

| File | Priority | One-line role |
| ---- | -------- | ------------- |
| `backend/manage.py` | SUPPORTING | Django CLI entry |
| `backend/config/settings.py` | **CORE** | All settings, `.env` loading, API keys, paths |
| `backend/config/asgi.py` | **CORE** | Top-level ASGI app (FastAPI) — the real entry point |
| `backend/config/urls.py` | SUPPORTING | Django URLconf — admin only |
| `backend/config/wsgi.py` | LOW PRIORITY | WSGI entry (unused by default run path) |
| `backend/core/models.py` | **CORE** | The 5 persistence models |
| `backend/core/admin.py` | IMPORTANT | Admin registration for all models |
| `backend/core/apps.py` | LOW PRIORITY | App config |
| `backend/core/views.py` | LOW PRIORITY | Empty placeholder |
| `backend/core/tests.py` | LOW PRIORITY | Empty placeholder (no tests) |
| `backend/core/migrations/0001_initial.py` | IMPORTANT | Schema migration 1 |
| `backend/core/migrations/0002_*.py` | IMPORTANT | Schema migration 2 (chunk_size/overlap, trace_json) |
| `backend/requirements.txt` | GENERATED / CONFIG | Pinned Python deps |

### FastAPI REST layer → `files/backend-fastapi.md`

| File | Priority | One-line role |
| ---- | -------- | ------------- |
| `backend/fastapi_app/main.py` | **CORE** | Builds FastAPI app, CORS, mounts routers + Django |
| `backend/fastapi_app/schemas.py` | IMPORTANT | Pydantic request/response models |
| `backend/fastapi_app/dependencies.py` | SUPPORTING | Shared `api_keys` / `db` dependencies |
| `backend/fastapi_app/routers/health.py` | SUPPORTING | `GET /api/health` |
| `backend/fastapi_app/routers/vectorstores.py` | IMPORTANT | `GET/POST /api/vectorstores` |
| `backend/fastapi_app/routers/ingestion.py` | **CORE** | `POST /api/documents` (multipart upload → ingest) |
| `backend/fastapi_app/routers/chat.py` | **CORE** | `POST /api/chat` (the RAG question flow) |
| `backend/fastapi_app/routers/benchmarks.py` | IMPORTANT | `GET/POST /api/benchmarks`, `GET /api/benchmarks/{id}` |

### RAG engine → `files/backend-rag-engine.md`

| File | Priority | One-line role |
| ---- | -------- | ------------- |
| `rag/registry.py` | IMPORTANT | Master aggregate registry |
| `rag/services/ingestion.py` | **CORE** | ingest_documents pipeline |
| `rag/services/retrieval.py` | **CORE** | build_retriever + rerank_documents |
| `rag/services/chatbot.py` | **CORE** | LLM builders + chain assembly |
| `rag/services/execution.py` | **CORE** | Stage-timed execution + trace |
| `rag/embeddings/__init__.py` + `openai/google/huggingface.py` | IMPORTANT | Embeddings factories + registry |
| `rag/vectorstores/__init__.py` + `chroma.py` | IMPORTANT | Chroma factories |
| `rag/loaders/__init__.py` + `directory_loader.py` | IMPORTANT | Loader factory |
| `rag/splitters/__init__.py` + `character.py` + `recursive.py` | IMPORTANT | Splitter factories |
| `rag/retrievers/__init__.py` + `base.py` + `contextual_compression.py` + `cohere_rerank.py` | IMPORTANT | Retriever factories |
| `rag/memory/__init__.py` + `buffer.py` + `summary.py` | IMPORTANT | Memory factories |
| `rag/prompts/__init__.py` + `answer.py` + `condense.py` | IMPORTANT | Prompt factories |
| `rag/chains/__init__.py` + `conversational.py` | IMPORTANT | Chain factory |
| `rag/benchmarks/runner.py` | IMPORTANT | build_matrix + run_benchmark |
| `rag/benchmarks/metrics.py` | SUPPORTING | Metrics context manager |
| `rag/apps.py`, `models.py`, `admin.py`, `views.py`, `tests.py` | LOW PRIORITY | Django app stubs (no models) |

### Frontend → `files/frontend.md`

| File | Priority | One-line role |
| ---- | -------- | ------------- |
| `frontend/src/main.tsx` | IMPORTANT | React root + BrowserRouter |
| `frontend/src/App.tsx` | IMPORTANT | Routes: `/`, `/stores`, `/benchmarks` |
| `frontend/src/api/client.ts` | **CORE** | Every backend API call |
| `frontend/src/models.ts` | **CORE** | Shared TypeScript types |
| `frontend/src/views/ChatWorkspace.tsx` | **CORE** | Chat page composition |
| `frontend/src/components/chat/ChatCanvas.tsx` | **CORE** | Chat panel logic + send flow |
| `frontend/src/components/chat/MessageBubble.tsx` | IMPORTANT | Renders one message + sources |
| `frontend/src/components/chat/SourceBadge.tsx` | IMPORTANT | Source chunk badge |
| `frontend/src/components/chat/PipelineSettingsPopover.tsx` | IMPORTANT | Provider/model/retriever/memory picker |
| `frontend/src/components/telemetry/TraceContext.tsx` | IMPORTANT | Global trace + focus state |
| `frontend/src/components/telemetry/PipelineTrace.tsx` | IMPORTANT | 4-stage trace panel |
| `frontend/src/components/workspace/StoresRail.tsx` | IMPORTANT | Store list rail |
| `frontend/src/components/IngestionModal.tsx` | IMPORTANT | Upload → ingest dialog |
| `frontend/src/components/StoresView.tsx` | IMPORTANT | `/stores` page |
| `frontend/src/components/BenchmarksLab.tsx` | IMPORTANT | `/benchmarks` page |
| `frontend/src/components/layout/NavRail.tsx` | SUPPORTING | Sidebar navigation |
| `frontend/src/lib/cn.ts`, `format.ts`, `highlight.ts` | SUPPORTING | Small helpers |
| `frontend/src/ui/*` (8 files) | SUPPORTING | Radix/Tailwind UI kit |
| `frontend/src/index.css` | SUPPORTING | Tailwind v4 theme + global styles |
| `frontend/vite.config.ts` | IMPORTANT | Dev server + proxy |
| `frontend/package.json`, `tsconfig*.json`, `.oxlintrc.json` | GENERATED / CONFIG | Build/lint config |

## How to use per-file entries

Every documented file in `files/*.md` follows this shape where the information exists:

- **Purpose** — what the file does.
- **Why it exists** — the responsibility it owns.
- **Imports** — important imports, split into internal (`file → file`) and library
  (`file → library`).
- **Exports** — what the module exposes.
- **Important classes / functions** — signatures, params, return, purpose, called-by,
  calls, side effects.
- **Dependencies / Dependents** — the verified import graph in both directions.
- **Beginner explanation** — plain-language summary.
- **Modification guide** — *when* you would touch this file.

Relationships in these files are **verified from source**. Anything not verifiable is
labelled `UNKNOWN / NEEDS VERIFICATION`.

## Start reading order

1. `files/backend-config-core.md` → `settings.py` + `asgi.py` (how the app boots).
2. `files/backend-fastapi.md` → `main.py` + `routers/chat.py` (how the API works).
3. `files/backend-rag-engine.md` → `services/execution.py`, `services/ingestion.py`
   (how the RAG pipeline works).
4. `files/frontend.md` → `views/ChatWorkspace.tsx`, `components/chat/ChatCanvas.tsx`,
   `api/client.ts` (how the UI drives it).
5. `files/root-and-config.md` → `Makefile`, `scripts/dev.sh`, `RAG_app.py` (how to run
   it and where it came from).