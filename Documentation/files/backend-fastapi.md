# files/backend-fastapi.md — FastAPI REST layer

> Covers: `fastapi_app/main.py`, `schemas.py`, `dependencies.py`, and the 5 routers.

---

## `backend/fastapi_app/main.py` — **CORE**

### Purpose
Builds the FastAPI application that uvicorn serves, then mounts Django inside it.

### Code flow (verified)
```python
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django; django.setup()
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.wsgi import WSGIMiddleware
from fastapi_app.routers import benchmarks, chat, health, ingestion, vectorstores

django_wsgi = get_wsgi_application()
app = FastAPI(title="RAG Bot API", description=..., version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ALLOWED_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(ingestion.router, prefix="/api", tags=["ingestion"])
app.include_router(vectorstores.router, prefix="/api", tags=["vectorstores"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(benchmarks.router, prefix="/api", tags=["benchmarks"])
app.mount("/", WSGIMiddleware(django_wsgi))
```

### Why it exists
It is the composition root: wires routers, CORS, and the Django WSGI mount. Ordering
matters — `/api` routers are added **before** the `/` mount so FastAPI takes precedence.

### Imports (module-level)
```text
fastapi_app/main.py
 ├── imports → fastapi (FastAPI, CORSMiddleware, WSGIMiddleware)
 ├── imports → fastapi_app.routers.{health, ingestion, vectorstores, chat, benchmarks}
 └── imports → django.conf.settings, django.core.wsgi.get_wsgi_application
```

### Exports
`app` (the FastAPI instance). No classes/functions to call elsewhere.

### Beginner explanation
Everything about "what the backend serves" starts here. Routes, CORS, and the Django
mount are all decided in this one function body.

### Modification guide
- Add a new router: `app.include_router(new_router, prefix="/api", ...)`.
- Change allowed CORS origins: edit `settings.CORS_ALLOWED_ORIGINS` (not here).
- Skip a router: remove one `include_router` line.

---

## `backend/fastapi_app/schemas.py` — IMPORTANT

### Purpose
Pydantic request/response models controlling API shapes + validation.

### Imports
```text
schemas.py
 ├── imports → enum.Enum, typing, Literal
 └── imports → pydantic.BaseModel, Field
```

### Important models (verified)
| Model | Kind | Fields (defaults) |
| ----- | ---- | ----------------- |
| `HealthResponse` | response | `status="ok"`, `api="fastapi"`, `django: str`, `version: str` |
| `EmbeddingName` | enum | `openai`, `google`, `huggingface` |
| `RetrieverName` | enum | `base`, `contextual_compression`, `cohere_rerank` |
| `VectorStoreCreate` | request | `name` (1-255), `embedding_provider` (enum, default `openai`) |
| `DocumentIngestResponse` | response | `vector_store`, `chunk_count`, `config: dict` |
| `ChatRequest` | request | `vector_store`, `question`, `llm_provider` (`openai/`google`/`huggingface`, default `google`), `model=""`, `language="english"`, `retriever` (enum, default `base`), `memory` (`buffer`/`summary`, default `buffer`), `temperature=0.5`, `top_p=0.95` |
| `ChatResponse` | response | `answer`, `source_documents: list[dict]`, `query_ms`, `retrieval_ms`, `rerank_ms`, `ttft_ms: float|None`, `token_estimate`, `trace: dict` |
| `BenchmarkRunCreate` | request | `name=""`, `config_matrix: dict[str, list[str]]` (e.g. `{"embeddings": ["openai","google"]}`) |
| `BenchmarkRunResponse` | response | `id`, `name`, `status`, `config_json` |

### Exports
All models above. No runtime functions.

### Beginner explanation
Pydantic enforces the wire contract. If the UI sends a `retriever` not in
`RetrieverName`, FastAPI returns a 422 automatically before the handler runs.

### Modification guide
Change request/response shapes for the API here (then mirror changes in
`frontend/src/models.ts`).

---

## `backend/fastapi_app/dependencies.py` — SUPPORTING

### Purpose
Shared FastAPI dependencies named in routers.

### Functions (verified)
- `api_keys() -> dict[str,str]` — returns `dict(settings.API_KEYS)`.
- `db()` — returns Django's `connection` object.

### Verified note
**No router currently declares `Depends(...)` for these.** They are convenience
helpers defined but unused by the present routers (grep-verified). Handle as
`UNUSED / available`.

### Modification guide
Use them (or remove them) when you refactor router dependency injection.

---

## `backend/fastapi_app/routers/health.py` — SUPPORTING

### Endpoint: `GET /api/health`
- Handler `health()` returns `HealthResponse(status="ok", api="fastapi",
  django=get_version(), version="0.1.0")`.
- Purpose: liveness probe proving both frameworks are wired in-process.
- Imports: `fastapi.APIRouter`, `django.conf.settings` (used only indirectly) /
  `django.get_version`.
- Modification guide: bump `version` or add DB connectivity checks.

---

## `backend/fastapi_app/routers/vectorstores.py` — IMPORTANT

### Endpoint: `GET /api/vectorstores`
- Handler `list_vectorstores()`:
  1. Queries Django `VectorStore.objects.annotate(document_count=Count("documents"))`
     and returns those records as `django`.
  2. Scans `settings.VECTOR_STORE_ROOT` for directories containing
     `chroma.sqlite3` and returns their names as `persisted`.
  3. Returns registry `list_vectorstores()` (the `rag` vectorstore engine variant
     names) as `engine_variants`.
- Response shape: `{"django": [...], "persisted": [...], "engine_variants": [...]}`.

### Endpoint: `POST /api/vectorstores`
- Payload: `VectorStoreCreate` (`name`, `embedding_provider`).
- Handler `create_vectorstore()`: `VectorStore.objects.get_or_create(name=..., defaults={
  embedding_provider, persist_path})`; returns `{"id", "name", "created"}`.

### Imports (function-local)
```text
vectorstores.py::list_vectorstores
 ├── imports → core.models.VectorStore, django.db.models.Count
 └── imports → rag.vectorstores.list_vectorstores
vectorstores.py::create_vectorstore
 └── imports → core.models.VectorStore
```

### Beginner explanation
This endpoint reconciles **Django records** with **actual Chroma directories on disk.**

### Verified quirk
Frontend `createVectorStore()` client method exists but is never called by the UI.
Instead, stores are created implicitly through document ingestion
(`POST /api/documents` → `get_or_create`).

### Modification guide
Change here to alter how stores are listed or created.

---

## `backend/fastapi_app/routers/ingestion.py` — **CORE**

### Endpoint: `POST /api/documents`
Query params: `vector_store` (required, str), `embedding_provider` (default `"openai"`),
`splitter` (default `"recursive"`), `chunk_size` (default 1600), `chunk_overlap`
(default 200). Body: multipart `files` (one or more `UploadFile`).

### Handler `ingest_documents(...)` flow (verified, line-by-line)
1. `if not files: raise HTTPException(422, "No files provided.")`
2. `VectorStore.objects.get_or_create(name=vector_store, defaults={...})`; overwrite
   `embedding_provider`, `chunk_size`, `chunk_overlap`, `persist_path`
   (`settings.VECTOR_STORE_ROOT / name`); `store.save()`.
3. Wipe `settings.TMP_DIR` (`glob("*")` + `unlink`).
4. Write each upload to `tmp_dir`, recording `file_hashes[filename] =
   sha1(content).hexdigest()`.
5. Call `run_ingestion = rag.services.ingestion.ingest_documents(
   tmp_dir, splitter_name, embeddings_name, persist_directory, api_keys, chunk_size,
   chunk_overlap)`.
6. On exception: if the store was just created, `store.delete()`; raise
   `HTTPException(500, "Ingestion failed: {exc}")`.
   `finally:` wipes `tmp_dir` again.
7. For each uploaded file: `Document.objects.update_or_create(vector_store=store,
   filename=filename, defaults={file_type, upload_hash, chunk_count, status=INGESTED})`.
8. Return `DocumentIngestResponse(vector_store, chunk_count,
   config={**result["config"], document_count, status:"ingested"})`.

### Imports (function-local)
```text
ingestion.py::ingest_documents
 ├── imports → core.models.{Document, VectorStore}
 └── imports → rag.services.ingestion.ingest_documents
```

### Beginner explanation
This is the "upload → ingest" API. It stages files on disk, delegates the heavy work to
`rag/services/ingestion.py`, and records per-file metadata in Django.

### Modification guide
Add supported file types (in `rag/loaders/directory_loader.py`), change default
chunking (also mirrored defaults in `core/models.py`), or change error handling.

---

## `backend/fastapi_app/routers/chat.py` — **CORE**

### Endpoint: `POST /api/chat`
Payload: `ChatRequest` (`vector_store`, `question`, `llm_provider`, `model`, `language`,
`retriever`, `memory`, `temperature`, `top_p`).

### Handler `chat(payload)` flow (verified)
1. Look up `VectorStore` by name; 404 if missing.
2. `api_keys = settings.API_KEYS`.
3. Build embeddings: `get_embeddings_factory(payload.llm_provider)(api_key=...)`.
4. `persist_directory = store.persist_path or VECTOR_STORE_ROOT / store.name`;
   `load_chroma_vectorstore(embeddings, persist_directory)`.
5. `build_retriever(vectorstore, embeddings, retriever_name=payload.retriever.value,
   api_keys)` → returns `{"retriever", "base_retriever", "compressor"}`.
6. `_build_llms(provider, api_key, model, temperature, top_p)` → `(condense_llm,
   response_llm)`.
7. Build memory: `get_memory("summary")(llm=condense_llm)` if summary, else
   `get_memory("buffer")()`.
8. Create `ChatSession` (vector_store, llm_provider, model, retriever_type, language);
   create a user `Message`.
9. `chat_history = memory.load_memory_variables({}).get("chat_history") or []`
   (always empty on a fresh in-memory buffer).
10. `result = execute_pipeline(vectorstore, compressor=retriever_info["compressor"],
    condense_llm, response_llm, question, chat_history, answer_prompt=
    get_prompt("answer")(language), condense_question_prompt=get_prompt("condense")(),
    k=16)`. **k is hardcoded to 16 here** regardless of the retriever build.
11. HF cleanup: strip `"\nAnswer: "` prefix if provider is `huggingface`.
12. `memory.save_context(...)`.
13. Estimate tokens ≈ `len(text)/4` for answer + each source chunk; build `sources`
    list with `source`, `page`, `content`, `score` (from `result["score_map"]` keyed by
    page content), `chunk_hash` (md5 prefix 12), `chunk_index`, `tokens`,
    `retrieval_ms`.
14. Build `trace` = `{**result["trace"], condensed_question, token_estimate,
    chunk_size, chunk_overlap, language, file_types (from store.documents), retriever,
    sources}`.
15. Create assistant `Message` with `sources_json=sources`, `trace_json=trace`.
16. Return `ChatResponse(...)` from the trace fields.

### Imports (function-local)
```text
chat.py::chat
 ├── imports → core.models.{ChatSession, Message, VectorStore}
 ├── imports → rag.embeddings.get_embeddings_factory
 ├── imports → rag.memory.get_memory
 ├── imports → rag.prompts.get_prompt
 ├── imports → rag.services.chatbot._build_llms
 ├── imports → rag.services.execution.execute_pipeline
 ├── imports → rag.services.retrieval.build_retriever
 └── imports → rag.vectorstores.chroma.load_chroma_vectorstore
```
Module-level: `_estimate_tokens(text)` helper (≈length/4).

### Beginner explanation
The chat endpoint assembles every RAG stage for one question, runs the explicit
stage-timed pipeline, and persists both the conversation and the trace. See
`07_API_PIPELINE.md` → chat pipeline and `05_FUNCTION_GRAPH.md`.

### Modification guide
Change retrieval `k`, change source/trace shape, add a new provider handling, or alter
memory wiring.

---

## `backend/fastapi_app/routers/benchmarks.py` — IMPORTANT

### Endpoints
- `POST /api/benchmarks` — payload `BenchmarkRunCreate` (`name`, `config_matrix`).
  - 422 if `config_matrix` is empty.
  - Creates `BenchmarkRun` with `config_json={"config_matrix": ...,
    "runs": build_matrix(config_matrix)}`.
  - **Synchronously** calls `run_benchmark(run)`, then `run.refresh_from_db()`.
  - Returns `BenchmarkRunResponse`.
- `GET /api/benchmarks` — lists all runs as values
  (`id, name, status, config_json, results_json, created_at`).
- `GET /api/benchmarks/{run_id}` — single run; 404 when not found.

### Imports
```text
benchmarks.py
 ├── imports (module) → rag.benchmarks.runner.{build_matrix, run_benchmark}
 └── imports (local) → core.models.BenchmarkRun
```

### Beginner explanation
POST starts an **immediate, synchronous** benchmark (potentially slow — it ingests and
queries LLMs per variant). Results are persisted on the run.

### Modification guide
Add result metrics in `rag/benchmarks/metrics.py` / `runner.py`; surface here if the
response shape should change.

---

## Summary table (routers)

| Router file | Endpoints | Handler functions |
| ----------- | --------- | ----------------- |
| `health.py` | `GET /api/health` | `health()` |
| `vectorstores.py` | `GET /api/vectorstores`, `POST /api/vectorstores` | `list_vectorstores()`, `create_vectorstore()` |
| `ingestion.py` | `POST /api/documents` | `ingest_documents()` |
| `chat.py` | `POST /api/chat` | `chat()` (+ helper `_estimate_tokens`) |
| `benchmarks.py` | `POST /api/benchmarks`, `GET /api/benchmarks`, `GET /api/benchmarks/{run_id}` | `create_benchmark()`, `list_benchmarks()`, `get_benchmark()` |