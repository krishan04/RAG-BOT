# 07 — API Pipeline

> End-to-end lifecycles for each major API. Every step names the actual file, class,
> function, and endpoint. Detailed pipelines live in `pipelines/`:

| Pipeline | File |
| -------- | ---- |
| Chat (`POST /api/chat`) | `pipelines/chat.md` |
| Document ingestion (`POST /api/documents`) | `pipelines/ingestion.md` |
| Vectorstores (`GET/POST /api/vectorstores`) | `pipelines/vectorstores.md` |
| Benchmarks (`POST /api/benchmarks`, `GET ...`) | `pipelines/benchmarks.md` |
| Health (`GET /api/health`) | `pipelines/health.md` |

## The universal shape

```text
React component (frontend/src/components|views/*)
 ↓
API client (frontend/src/api/client.ts)
 ↓  fetch() → Vite dev proxy → http://127.0.0.1:8000
FastAPI router (backend/fastapi_app/routers/<name>.py)
 ↓  Pydantic validation (backend/fastapi_app/schemas.py)
rag services (backend/rag/services/*.py)
 ↓
rag component registries (backend/rag/<component>/__init__.py)
 ↓
External providers (OpenAI / Gemini / HuggingFace / Cohere / Chroma)
 ↓  + Django ORM (backend/core/models.py → SQLite)
Response (schemas) → router → fetch → React state → UI
```

## Quick cross-reference

| Endpoint | Frontend caller | Router | Service(s) | DB / store side effects |
| -------- | --------------- | ------ | ---------- | ----------------------- |
| `GET /api/health` | `client.getHealth` (NavRail) | `health.health` | — | — |
| `GET /api/vectorstores` | `client.getVectorStores` | `vectorstores.list_vectorstores` | — (direct ORM + dir scan) | reads `VectorStore`; lists `data/vector_stores/*` |
| `POST /api/vectorstores` | (unused in UI) | `vectorstores.create_vectorstore` | — | writes `VectorStore` |
| `POST /api/documents` | `client.uploadDocuments` (IngestionModal) | `ingestion.ingest_documents` | `rag.services.ingestion.ingest_documents` | writes `Chroma` under `data/vector_stores`; writes `VectorStore` + `Document` |
| `POST /api/chat` | `client.sendChat` (ChatCanvas) | `chat.chat` | `execute_pipeline`, `build_retriever`, `_build_llms` | reads `Chroma`; writes `ChatSession` + `Message` |
| `POST /api/benchmarks` | `client.runBenchmark` (BenchmarksLab) | `benchmarks.create_benchmark` | `run_benchmark`, `build_matrix` | writes `BenchmarkRun`; scratch Chroma under `backend/storage/tmp` |
| `GET /api/benchmarks` | `client.listBenchmarks` (BenchmarksLab) | `benchmarks.list_benchmarks` | — | reads `BenchmarkRun` |
| `GET /api/benchmarks/{id}` | (unused in UI) | `benchmarks.get_benchmark` | — | reads `BenchmarkRun` |