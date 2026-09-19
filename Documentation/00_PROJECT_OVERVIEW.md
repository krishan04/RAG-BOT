# 00 — Project Overview

> **RAG Bot** — a monolithic Retrieval-Augmented Generation (RAG) chatbot with a
> pluggable RAG engine, a REST API, and a web chat UI.

## What this project does

RAG (Retrieval-Augmented Generation) is a technique where a chatbot does not rely
only on the knowledge baked into an LLM. Instead, it:

1. **Indexes** your own documents into a *vector database* (a store that can search
   for text by meaning, not just by keyword).
2. When you ask a question, it **retrieves** the most relevant snippets from that store.
3. It hands the snippets plus your question to an LLM, which writes an **answer using
   only that context**.

This project is a full-stack implementation of that idea:

- Upload documents (`.pdf`, `.txt`, `.csv`, `.docx`) via the UI, the API, or the Django admin.
- Documents are chunked, embedded, and persisted into Chroma vectorstores under `data/vector_stores/`.
- Chat against any vectorstore; every answer shows its **source documents, scores, and a
  per-stage execution trace** (how long each pipeline step took).
- A **benchmark harness** compares component variants (e.g. OpenAI vs Google embeddings
  × base vs Cohere rerank retriever) and records ingestion/query latency.

## Problem being solved

Building RAG apps in a Jupyter/Streamlit prototype is fast but unstructured. This project
turns a legacy Streamlit prototype (`RAG_app.py`) into a production-shaped monolith where:

- Every RAG component is a small, **swappable, registry-driven module** (loaders,
  splitters, embeddings, vectorstores, retrievers, memory, prompts, chains).
- Pipeline metadata is **persisted** (vectorstores, documents, chat sessions, messages,
  benchmark runs) instead of living in ephemeral session state.
- A REST API lets a React UI drive the same pipeline the prototype drove click-by-click.

## Target users

- Developers building RAG applications who want a reference monolith.
- A developer or operator who wants to chat with a document collection and compare
  embedding/retriever variants empirically.

## Major features

| Feature | Where it lives |
| ------- | -------------- |
| Document ingestion (upload → load → split → embed → persist) | `backend/fastapi_app/routers/ingestion.py`, `backend/rag/services/ingestion.py` |
| Vectorstore management (list/create; Chroma scan) | `backend/fastapi_app/routers/vectorstores.py` |
| Chat with RAG (answer + sources + trace telemetry) | `backend/fastapi_app/routers/chat.py`, `backend/rag/services/execution.py` |
| Pipeline trace / "MLOps cockpit" UI | `frontend/src/components/telemetry/*`, `frontend/src/components/chat/*` |
| Benchmark runner (component-variant matrix) | `backend/rag/benchmarks/runner.py`, `backend/fastapi_app/routers/benchmarks.py` |
| Django admin for the persisted records | `backend/core/admin.py` |
| React dashboard UI | `frontend/src/*` |

## Technology stack

| Concern | Technology | Where |
| ------- | ---------- | ----- |
| Backend web server | FastAPI 0.109 + Uvicorn 0.27 | `backend/fastapi_app/`, `backend/config/asgi.py` |
| ORM / migrations / admin / auth | Django 5.2 | `backend/core/`, `backend/config/settings.py` |
| RAG orchestration | LangChain 0.1.x (`langchain`, `langchain-community`, `langchain-openai`, `langchain-google-genai`) | `backend/rag/` |
| Vector database | Chroma (chromadb 0.4.22) | `backend/rag/vectorstores/chroma.py`, `data/vector_stores/` |
| Relational database | SQLite (`backend/db.sqlite3`) | `backend/config/settings.py` |
| Embedded challenge | `rag/embeddings/` — OpenAI, Google Gemini, HuggingFace | `backend/rag/embeddings/` |
| LLM providers (chat) | OpenAI / Google Gemini / HuggingFace | `backend/rag/services/chatbot.py` |
| Reranker | Cohere `rerank-multilingual-v3.0` | `backend/rag/retrievers/cohere_rerank.py` |
| Frontend | React 19 + Vite 8 + TypeScript + Tailwind CSS v4 + Radix UI | `frontend/` |
| Frontend telemetry visual | `@tanstack/react-virtual`, `react-markdown`, `highlight.js` | `frontend/src/components/chat/`, `frontend/src/components/telemetry/` |
| Legacy reference app | Streamlit | `RAG_app.py` |

## Architecture at a glance

```
User
 ↓
React Frontend (Vite dev server, :5173, proxies /api → :8000)
 ↓  HTTP JSON
FastAPI REST layer  (/api/*)   ← top-level ASGI app
 ↓
rag services (ingestion / retrieval / chatbot / execution)
 ↓
registry-driven components (loaders, splitters, embeddings,
                            vectorstores, retrievers, memory, prompts, chains)
 ↓                        ↓
Chroma vectorstores     Django ORM → SQLite (db.sqlite3)
data/vector_stores/     (VectorStore, Document, ChatSession,
                         Message, BenchmarkRun)
 ↓
External AI APIs: OpenAI / Google Gemini / HuggingFace / Cohere
```

## Applications / processes involved

| Process | What it runs | Entry point |
| ------- | ------------ | ----------- |
| Backend (one ASGI process serving both FastAPI and Django) | `uvicorn config.asgi:application` | `backend/config/asgi.py` → `backend/fastapi_app/main.py` |
| Frontend dev server | `npm run dev` (Vite) | `frontend/src/main.tsx` |
| Django CLI (migrations, superuser) | `python manage.py ...` | `backend/manage.py` |
| Legacy Streamlit app (reference only) | `streamlit run RAG_app.py` | `RAG_app.py` |

Both backend and frontend are started together by `scripts/dev.sh` (or `make dev`).

## Databases

| Store | Technology | Location | Contents |
| ----- | ---------- | -------- | -------- |
| Relational | SQLite | `backend/db.sqlite3` | Metadata: vectorstores, documents, chat sessions, messages, benchmark runs |
| Vector | Chroma | `data/vector_stores/<name>/chroma.sqlite3` | Embeddings + chunks per vectorstore |

## External services

| Service | Used for | Key env var (name only) |
| ------- | -------- | ----------------------- |
| OpenAI API | Embeddings + chat LLM | `OPENAI_API` |
| Google Gemini API | Embeddings + chat LLM | `GEMINI_API` |
| HuggingFace Inference API | Embeddings + chat LLM | `HF_API` |
| Cohere API | Reranking retrieved chunks | `COHERE_API` |

> Note: `.env` currently contains only `GEMINI_API` and `COHERE_API`. `OPENAI_API` and
> `HF_API` are read by the code but currently unset — see `11_CONFIGURATION.md`.

## How the components communicate

1. **Frontend → Backend:** HTTP via the Vite dev proxy. `frontend/vite.config.ts` proxies
   `/api`, `/admin`, and `/static` to `http://127.0.0.1:8000`. All client calls go through
   `frontend/src/api/client.ts`.
2. **FastAPI → RAG engine:** routers call the `rag` service layer and component factories
   (via per-component registries that map string names → factory functions).
3. **RAG engine → vector DB:** `rag/vectorstores/chroma.py` creates/loads Chroma stores.
4. **RAG engine → relational DB:** `core` Django models are persisted via the ORM
   (`core/models.py`). FastAPI handlers call the ORM directly (Django is configured in the
   same process via `django.setup()` in `backend/fastapi_app/main.py`).
5. **RAG engine → LLM providers:** `rag/services/chatbot.py` and `rag/embeddings/*` build
   LangChain clients that call OpenAI / Google / HuggingFace / Cohere over HTTPS.

## Next steps

- Want the folder map? → `01_REPOSITORY_STRUCTURE.md`
- Want the full architecture and the layered diagram? → `02_ARCHITECTURE.md`
- Want to read this project like a graph of files? → `04_FILE_GRAPH.md`
- Want the exact API requests/responses? → `06_API_DOCUMENTATION.md`