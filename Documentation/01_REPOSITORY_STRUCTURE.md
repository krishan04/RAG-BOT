# 01 — Repository Structure

> A map of every directory and important file, what it is for, and which entry /
> configuration / build / deployment files matter.

## Repository tree

```
RAG Bot/
├── .env                            # Local secrets (gitignored) — only GEMINI_API, COHERE_API present
├── .gitignore
├── Makefile                        # setup / run / db commands (dev workflow)
├── README.md                       # Top-level project README
├── RAG_app.py                      # LEGACY Streamlit app — reference for the RAG port
├── RAG_notebook.ipynb              # LEGACY notebook — reference/history (not part of runtime)
├── session-ses_0d8f.md             # Transcript of the session that built this project (gitignored)
├── venv/                           # Python virtual environment (gitignored)
│
├── backend/                        # Django + FastAPI monolith
│   ├── manage.py                   # Django CLI entry point
│   ├── requirements.txt            # Pinned Python dependencies
│   ├── db.sqlite3                  # SQLite relational DB (runtime artifact, gitignored)
│   ├── storage/                    # uploads / temp files (gitignored)
│   ├── config/                     # Django project package
│   │   ├── __init__.py
│   │   ├── settings.py             # All Django+monolith settings
│   │   ├── asgi.py                 # ASGI entry (FastAPI top-level + Django mounted)
│   │   ├── urls.py                 # Django URLs (admin only)
│   │   └── wsgi.py                 # WSGI entry (for classic Django servers)
│   ├── core/                       # Django app: persisted metadata models
│   │   ├── __init__.py
│   │   ├── admin.py                # Admin registrations for all 5 models
│   │   ├── apps.py                 # AppConfig
│   │   ├── models.py               # VectorStore, Document, ChatSession, Message, BenchmarkRun
│   │   ├── views.py                # Empty placeholder
│   │   ├── tests.py                # Empty placeholder (no tests)
│   │   └── migrations/             # 0001_initial, 0002_... (schema migrations)
│   ├── fastapi_app/                # FastAPI REST layer (/api/*)
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app build, CORS, router mounts, Django WSGI mount
│   │   ├── dependencies.py         # Shared FastAPI dependencies (api_keys, db)
│   │   ├── schemas.py              # Pydantic request/response models
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── health.py           # GET /api/health
│   │       ├── vectorstores.py     # GET/POST /api/vectorstores
│   │       ├── ingestion.py        # POST /api/documents
│   │       ├── chat.py             # POST /api/chat
│   │       └── benchmarks.py       # GET/POST /api/benchmarks, GET /api/benchmarks/{id}
│   └── rag/                        # Pluggable RAG engine (Django app, no models)
│       ├── __init__.py
│       ├── apps.py                 # AppConfig ('rag')
│       ├── models.py               # Empty placeholder (no models in rag)
│       ├── admin.py                # Empty placeholder
│       ├── views.py                # Empty placeholder
│       ├── tests.py                # Empty placeholder (no tests)
│       ├── registry.py             # Master aggregate component registry
│       ├── services/
│       │   ├── __init__.py
│       │   ├── ingestion.py        # load → split → embed → persist pipeline
│       │   ├── retrieval.py        # build_retriever + explicit rerank stage
│       │   ├── chatbot.py          # LLM builders + chain assembly
│       │   └── execution.py        # Explicit stage-timed RAG execution + trace
│       ├── loaders/
│       │   ├── __init__.py         # loader registry
│       │   └── directory_loader.py # txt/pdf/csv/docx DirectoryLoader factory
│       ├── splitters/
│       │   ├── __init__.py         # splitter registry
│       │   ├── character.py        # CharacterTextSplitter (compression)
│       │   └── recursive.py        # RecursiveCharacterTextSplitter (ingestion)
│       ├── embeddings/
│       │   ├── __init__.py         # embeddings registry
│       │   ├── openai.py           # OpenAIEmbeddings factory
│       │   ├── google.py           # GoogleGenerativeAIEmbeddings factory (+live probe)
│       │   └── huggingface.py      # HuggingFaceInferenceAPIEmbeddings factory
│       ├── vectorstores/
│       │   ├── __init__.py         # vectorstore registry
│       │   └── chroma.py           # create / load Chroma vectorstore
│       ├── retrievers/
│       │   ├── __init__.py         # retriever registry
│       │   ├── base.py             # vectorstore.as_retriever wrapper
│       │   ├── contextual_compression.py  # compression pipeline retriever
│       │   └── cohere_rerank.py    # Cohere rerank retriever
│       ├── memory/
│       │   ├── __init__.py         # memory registry
│       │   ├── buffer.py           # ConversationBufferMemory factory
│       │   └── summary.py          # ConversationSummaryBufferMemory factory
│       ├── prompts/
│       │   ├── __init__.py         # prompt registry
│       │   ├── answer.py           # answer ChatPromptTemplate
│       │   └── condense.py         # condense-question PromptTemplate
│       ├── chains/
│       │   ├── __init__.py         # chain registry
│       │   └── conversational.py   # ConversationalRetrievalChain factory
│       └── benchmarks/
│           ├── __init__.py
│           ├── runner.py           # matrix builder + run_benchmark
│           ├── metrics.py          # Metrics context manager (latency)
│           └── reports/            # (empty; .gitkeep)
│
├── data/
│   ├── benchmark/
│   │   └── intro.txt               # Fixed corpus for the benchmark harness
│   └── vector_stores/              # Chroma stores (gitignored)
│       └── <name>/chroma.sqlite3   # one dir per vectorstore
│
├── frontend/                       # React + Vite + TypeScript
│   ├── package.json                # deps + scripts (dev/build/lint/preview)
│   ├── package-lock.json
│   ├── index.html
│   ├── vite.config.ts              # dev server + /api,/admin,/static proxy → :8000
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── .oxlintrc.json              # lint config (oxlint)
│   ├── .gitignore
│   ├── public/favicon.svg
│   ├── dist/                       # built assets (gitignored, present locally)
│   └── src/
│       ├── main.tsx                # React root + BrowserRouter
│       ├── index.css               # Tailwind v4 theme + global styles
│       ├── App.tsx                 # routes: / /stores /benchmarks
│       ├── vite-env.d.ts
│       ├── models.ts               # shared TS types (ChatResponse, ChatMessage, etc.)
│       ├── api/
│       │   └── client.ts           # all backend API calls
│       ├── lib/
│       │   ├── cn.ts               # clsx + tailwind-merge helper
│       │   ├── format.ts           # formatMs / relative time helpers
│       │   └── highlight.ts        # syntax highlight theme for markdown code
│       ├── ui/                     # hand-rolled Radix/Tailwind UI kit
│       │   ├── badge.tsx  button.tsx  dialog.tsx  input.tsx
│       │   ├── popover.tsx  scroll-area.tsx  select.tsx  tooltip.tsx
│       ├── components/
│       │   ├── layout/NavRail.tsx        # left sidebar navigation
│       │   ├── workspace/StoresRail.tsx  # store list on the chat page
│       │   ├── chat/ChatCanvas.tsx       # main chat panel (messages, send, drag-drop)
│       │   ├── chat/MessageBubble.tsx    # one message + sources
│       │   ├── chat/SourceBadge.tsx      # a source-document badge/chunk
│       │   ├── chat/PipelineSettingsPopover.tsx  # provider/model/retriever/memory picker
│       │   ├── telemetry/TraceContext.tsx        # global trace + chunk focus state
│       │   ├── telemetry/PipelineTrace.tsx       # 4-stage trace panel
│       │   ├── IngestionModal.tsx  # upload → ingest dialog
│       │   ├── StoresView.tsx      # /stores page (all stores)
│       │   └── BenchmarksLab.tsx   # /benchmarks page (run + list benchmarks)
│       └── views/ChatWorkspace.tsx # / page: StoresRail + ChatCanvas + PipelineTrace
│
├── path_to_db/                     # stray Chroma DB copy (gitignored; not used by runtime)
└── scripts/
    └── dev.sh                      # start backend + frontend together
```

## Directory purpose table

| Directory | Purpose | Important files |
| --------- | ------- | --------------- |
| `backend/config/` | Django project package: settings, ASGI/WSGI entry, admin URLconf | `settings.py`, `asgi.py`, `urls.py`, `wsgi.py` |
| `backend/core/` | Django app holding the persisted metadata models + admin | `models.py`, `admin.py`, `migrations/0001_initial.py` |
| `backend/fastapi_app/` | FastAPI REST layer mounted into the same ASGI process | `main.py`, `schemas.py`, `routers/*.py` |
| `backend/rag/` | The pluggable RAG engine (component packages + services + benchmarks) | `registry.py`, `services/*.py`, every `*/__init__.py` registry |
| `backend/storage/` | runtime upload/temp dir (gitignored) | `tmp/` (staging uploads, benchmark scratch Chroma) |
| `data/vector_stores/` | persisted Chroma vectorstores, shared with the legacy app | `<name>/chroma.sqlite3` |
| `data/benchmark/` | fixed corpus for benchmarks | `intro.txt` |
| `frontend/src/` | React source | `main.tsx`, `App.tsx`, `api/client.ts`, `components/`, `views/`, `ui/` |
| `scripts/` | dev runner | `dev.sh` |
| `venv/` | Python virtual environment (gitignored) | — |
| `path_to_db/` | stray Chroma copy, unused by runtime (gitignored) | — |

## Key files by category

### Entry points

| Purpose | File |
| ------- | ---- |
| Backend ASGI application (FastAPI + Django in one process) | `backend/config/asgi.py` |
| FastAPI app construction | `backend/fastapi_app/main.py` |
| Django CLI (migrations / superuser) | `backend/manage.py` |
| Frontend React root | `frontend/src/main.tsx` |
| Legacy Streamlit app | `RAG_app.py` |
| Dev runner (backend + frontend) | `scripts/dev.sh` |

### Configuration files

| Purpose | File |
| ------- | ---- |
| Django settings + monolith paths + API key map | `backend/config/settings.py` |
| Local secrets (names only: `GEMINI_API`, `COHERE_API`) | `.env` |
| Vite dev server + proxy rules | `frontend/vite.config.ts` |
| TypeScript config | `frontend/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` |
| Lint config (frontend) | `frontend/.oxlintrc.json` |
| Git ignores | `.gitignore`, `frontend/.gitignore` |

### Build / package files

| Purpose | File |
| ------- | ---- |
| Python dependencies (fully pinned) | `backend/requirements.txt` |
| Frontend package manifest + scripts | `frontend/package.json`, `package-lock.json` |
| Makefile build/dev commands | `Makefile` |

### Deployment files

There is **no** Dockerfile, docker-compose, CI config (`.github/workflows`, etc.), or
hosting config in this repository. "Deployment" today is:

- Dev: `scripts/dev.sh` (uvicorn on `127.0.0.1:8000` + Vite on `5173`).
- Production-adjacent: run `uvicorn config.asgi:application` from `backend/` and serve
  the built frontend (`frontend/dist/`) behind it — but none of this is automated.

### Test directories / files

- `backend/core/tests.py` — empty Django stub (no tests).
- `backend/rag/tests.py` — empty Django stub (no tests).
- No `frontend` tests, no `tests/` package, no pytest/jest/vitest config.

See `13_TESTING.md`.

## Git status note (verified)

At analysis time, git tracks only: `RAG_app.py`, `RAG_notebook.ipynb`, `README.md`,
`.gitignore`, `backend/requirements.txt` (renamed). The entire monolith, frontend,
scripts, data, and this `Documentation/` directory are **untracked**. Onboarding with
`git clone` will not yet obtain the working application — see `17_DEVELOPER_ONBOARDING.md`.