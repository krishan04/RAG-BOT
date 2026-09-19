# RAG Bot

Monolithic RAG chatbot: **Django** (ORM / admin / auth) + **FastAPI** (RAG API)
running in a single ASGI process, with a **React (Vite + TypeScript)** frontend.

The legacy Streamlit app (`RAG_app.py`) is kept as a reference for the RAG
port (Phase 3).

## Structure

```
.
├── backend/            Django + FastAPI monolith
│   ├── config/         Django project (settings, asgi mounts FastAPI)
│   ├── core/           Django app: VectorStore, Document, ChatSession, Message, BenchmarkRun
│   ├── rag/            RAG engine (folder-per-component: loaders, splitters,
│   │                   embeddings, vectorstores, retrievers, memory, chains, prompts)
│   ├── fastapi_app/    FastAPI REST layer (/api/*)
│   ├── storage/        uploads / temp files (gitignored)
│   └── requirements.txt
├── frontend/           React + Vite + TypeScript dev app
├── data/
│   └── vector_stores/  Chroma stores (shared with the legacy app)
├── scripts/dev.sh      run backend + frontend concurrently
├── Makefile            setup / run / db commands
└── RAG_app.py          legacy Streamlit app (reference)
```

## Setup (one-time)

```bash
make setup       # create venv + install backend & frontend dependencies
make db          # apply Django migrations
make superuser   # create a Django admin user (prompts interactively)
```

## Run

```bash
make dev         # backend (uvicorn :8000) + frontend (Vite :5173) together
```

Or run each in its own terminal:

```bash
make backend     # http://127.0.0.1:8000
make frontend    # http://localhost:5173
```

Stop everything with Ctrl-C, or `make stop`.

## Endpoints

| URL                       | Purpose                          |
| ------------------------- | -------------------------------- |
| http://localhost:5173     | React app (via Vite proxy)      |
| http://127.0.0.1:8000/api/health | Health check                    |
| http://127.0.0.1:8000/api/vectorstores | List/create vectorstores (incl. Chroma scan) |
| http://127.0.0.1:8000/api/documents   | Multipart upload → ingest into a vectorstore |
| http://127.0.0.1:8000/api/chat        | Ask questions with RAG (answer + source docs) |
| http://127.0.0.1:8000/api/benchmarks  | Run/inspect component-variant benchmarks |
| http://127.0.0.1:8000/admin     | Django admin                    |
| http://127.0.0.1:8000/docs      | FastAPI interactive docs        |

## Phase status

- **Phase 1 (done)** — backend monolith skeleton, migrations, component-per-folder RAG engine, FastAPI wiring.
- **Phase 2 (done)** — React frontend skeleton wired to `/api/health`.
- **Phase 3 (done)** — RAG logic ported per component: real document ingestion (upload → load → split → embed → persist Chroma), real chat (retriever per type, chain + memory, source documents), persisted vectorstore & chat records, and a working benchmark runner (component-variant matrix → ingestion/query latency per variant) exposed via `/api/benchmarks`.
- **Phase 4 (next)** — richer benchmark metrics (tokens/cost/relevance), background benchmark jobs, auth/tenants.