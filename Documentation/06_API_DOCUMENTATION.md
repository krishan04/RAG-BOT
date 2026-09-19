# 06 — API Documentation

> Every HTTP endpoint in the backend, with request/response shapes and error behavior.
> All endpoints are served by FastAPI under the `/api` prefix. Base URL in dev:
> `http://127.0.0.1:8000` (frontend reaches it via the Vite proxy).

## Endpoint index

| Method | Endpoint | File / Function | Purpose |
| ------ | -------- | --------------- | ------- |
| GET | `/api/health` | `fastapi_app/routers/health.py` → `health()` | Liveness probe |
| GET | `/api/vectorstores` | `vectorstores.py` → `list_vectorstores()` | List stores (Django + persisted Chroma + engine variants) |
| POST | `/api/vectorstores` | `vectorstores.py` → `create_vectorstore()` | Create a store record |
| POST | `/api/documents` | `ingestion.py` → `ingest_documents()` | Upload file(s) → ingest into a store |
| POST | `/api/chat` | `chat.py` → `chat()` | Ask a question with RAG |
| POST | `/api/benchmarks` | `benchmarks.py` → `create_benchmark()` | Run a benchmark (variant matrix) |
| GET | `/api/benchmarks` | `benchmarks.py` → `list_benchmarks()` | List benchmark runs |
| GET | `/api/benchmarks/{run_id}` | `benchmarks.py` → `get_benchmark()` | Get one benchmark run |

Plus Django routes (not FastAPI): `GET /admin/*` (Django admin, needs login) and
`/static/*`.

---

## GET `/api/health`

### Request
```http
GET /api/health
```
No body, no params.

### Processing
```text
Request → health() → HealthResponse
```

### Response 200
```json
{
  "status": "ok",
  "api": "fastapi",
  "django": "5.2.17",
  "version": "0.1.0"
}
```

### Errors
None. Always 200 if the process is up.

---

## GET `/api/vectorstores`

### Request
```http
GET /api/vectorstores
```

### Processing
```text
Request
 ↓
list_vectorstores()
 ├── VectorStore.objects.annotate(document_count=Count("documents")).values(...)
 ├── scan VECTOR_STORE_ROOT for dirs containing chroma.sqlite3
 └── rag.vectorstores.list_vectorstores()  → ["chroma"]
```

### Response 200
```json
{
  "django": [
    {
      "id": 1,
      "name": "CV",
      "embedding_provider": "google",
      "persist_path": "/…/data/vector_stores/CV",
      "chunk_size": 1600,
      "chunk_overlap": 200,
      "created_at": "2026-09-18T…",
      "document_count": 3
    }
  ],
  "persisted": ["CV", "Vit_All_HF_Embeddings"],
  "engine_variants": ["chroma"]
}
```

### Errors
None (empty lists on missing data). Note: `engine_variants` comes from the rag registry
and is **not rendered** by the current UI (verified quirk).

---

## POST `/api/vectorstores`

### Request
```json
{
  "name": "my-base",
  "embedding_provider": "openai"
}
```
`name` required (1-255 chars). `embedding_provider` optional enum
(`openai` | `google` | `huggingface`), default `openai`.

### Processing
```text
Request → create_vectorstore(VectorStoreCreate)
 ├── VectorStore.objects.get_or_create(name=…, defaults={embedding_provider, persist_path})
 └── persist_path = settings.VECTOR_STORE_ROOT / name
```

### Response 200
```json
{ "id": 3, "name": "my-base", "created": true }
```

### Errors
- `get_or_create` respects the unique `name`; on a duplicate it returns `created: false`
  (not an error).
- 422 validation errors from Pydantic (bad enum, name too long/short).

---

## POST `/api/documents` (multipart)

### Request
Query params:
| Param | Type | Default | Meaning |
| ----- | ---- | ------- | ------- |
| `vector_store` | str | *(required)* | Store name (created if missing) |
| `embedding_provider` | str | `openai` | `openai`/`google`/`huggingface` |
| `splitter` | str | `recursive` | `recursive`/`character` |
| `chunk_size` | int | `1600` | Recursive splitter chunk size |
| `chunk_overlap` | int | `200` | Recursive splitter overlap |

Body: `multipart/form-data`, field `files`, one or more files
(supported: `.txt`, `.pdf`, `.csv`, `.docx` per `rag/loaders/directory_loader.py`).

Example (frontend equivalent):
```http
POST /api/documents?vector_store=CV&embedding_provider=google&chunk_size=1600&chunk_overlap=200
Content-Type: multipart/form-data

files=@intro.txt
```

### Processing
```text
Request (UploadFile list)
 ↓ ingest_documents() [router]
 ├── 422 if no files
 ├── VectorStore.objects.get_or_create(...) + save() (persist_path, chunk config)
 ├── wipe TMP_DIR, write uploads there
 ├── rag.services.ingestion.ingest_documents(...)
 │    ├── load_documents() → DirectoryLoader (txt/pdf/csv/docx)
 │    ├── get_splitter("recursive") → split_documents
 │    ├── get_embeddings_factory(provider) → embeddings
 │    └── get_vectorstore_factory("chroma") → Chroma.from_documents → persist
 ├── wipe TMP_DIR (finally)
 ├── Document.objects.update_or_create(...) per file
 └── DocumentIngestResponse
```

### Response 200
```json
{
  "vector_store": "CV",
  "chunk_count": 42,
  "config": {
    "splitter": "recursive",
    "embeddings": "google",
    "vectorstore": "chroma",
    "chunk_size": 1600,
    "chunk_overlap": 200,
    "document_count": 1,
    "status": "ingested"
  }
}
```

### Errors
- `422` `{"detail": "No files provided."}` when `files` is empty.
- `500` `{"detail": "Ingestion failed: <exc>"}` when the pipeline raises. If the store
  was just created by this request, it is **deleted** first (ingestion.py:76-79).
- Missing provider key → provider-specific failure inside the `500` (e.g. Google
  embeddings live-probe fails without a valid `GEMINI_API`).

---

## POST `/api/chat`

### Request
```json
{
  "vector_store": "CV",
  "question": "Which components can be benchmarked?",
  "llm_provider": "google",
  "model": "gemini-2.5-flash",
  "language": "english",
  "retriever": "base",
  "memory": "buffer",
  "temperature": 0.5,
  "top_p": 0.95
}
```
Defaults (verified from `schemas.py`): `llm_provider=google`, `language=english`,
`retriever=base`, `memory=buffer`, `temperature=0.5`, `top_p=0.95`, `model=""` (uses
provider default). `vector_store` and `question` required.

### Processing (the full RAG pipeline)
```text
Request (ChatRequest)
 ↓ chat()
 ├── 404 if vector_store not found
 ├── embeddings = get_embeddings_factory(llm_provider)(api_key)
 ├── vectorstore = load_chroma_vectorstore(embeddings, persist_directory)
 ├── retriever_info = build_retriever(vectorstore, embeddings, retriever.name, api_keys)
 ├── (condense_llm, response_llm) = _build_llms(...)
 ├── memory = get_memory("summary")(llm=condense_llm) | get_memory("buffer")()
 ├── ChatSession.objects.create(...); Message(user).objects.create(...)
 ├── execute_pipeline(k=16)
 │    ├── Stage 1 condense question (LLMChain)          [condense_ms]
 │    ├── Stage 2 similarity_search_with_score(k=16)     [k_retrieved, score_bounds]
 │    ├── Stage 3 rerank/compress via compressor         [rerank_ms, k_filtered]
 │    └── Stage 4 response_llm.stream (TTFT callback)    [generation_ms, ttft_ms, query_ms]
 ├── (huggingface: strip "\nAnswer: ")
 ├── memory.save_context(...)
 ├── build sources[] with per-chunk score/tokens/chunk_hash
 ├── Message(assistant).objects.create(sources_json=…, trace_json=…)
 └── ChatResponse
```

### Response 200
```json
{
  "answer": "…",
  "source_documents": [
    {
      "source": "intro.txt",
      "page": 1,
      "content": "…",
      "score": 0.812345,
      "chunk_hash": "a1b2c3d4e5f6",
      "chunk_index": 0,
      "tokens": 412,
      "retrieval_ms": 8.1
    }
  ],
  "query_ms": 1250.4,
  "retrieval_ms": 8.1,
  "rerank_ms": 0.0,
  "ttft_ms": 620.2,
  "token_estimate": 520,
  "trace": {
    "condense_ms": 0.0,
    "query_ms": 1250.4,
    "retrieval_ms": 8.1,
    "rerank_ms": 0.0,
    "generation_ms": 630.0,
    "ttft_ms": 620.2,
    "token_estimate": 520,
    "k_retrieved": 16,
    "k_filtered": 16,
    "score_bounds": {"min": 0.753, "max": 0.892},
    "condensed_question": "Which components can be benchmarked?",
    "chunk_size": 1600,
    "chunk_overlap": 200,
    "language": "english",
    "file_types": ["txt"],
    "retriever": "base",
    "sources": []
  }
}
```
(Field values illustrative; shapes verified against `ChatResponse` and `chat.py`.)

### Errors
- `404` `{"detail": "Vectorstore '<name>' not found."}` when the store is unknown.
- Provider/network failures bubble up as **500** (uncaught). No custom error handling
  exists beyond the 404 (verified).
- `422` for invalid enum values (`retriever`, `llm_provider`, `memory`) from Pydantic.

---

## POST `/api/benchmarks`

### Request
```json
{
  "name": "emb-vs-retriever",
  "config_matrix": {
    "embeddings": ["openai", "google"],
    "retrievers": ["base", "cohere_rerank"]
  }
}
```
`name` optional (backend defaults to `"Benchmark"`). `config_matrix` required,
non-empty (`{"embeddings": [...], "retrievers": [...]}`) — entries must be lists.

### Processing
```text
Request (BenchmarkRunCreate)
 ↓ create_benchmark()
 ├── 422 if config_matrix empty
 ├── runs = build_matrix(config_matrix)   → cartesian product
 ├── BenchmarkRun.objects.create(config_json={config_matrix, runs})
 ├── run_benchmark(run)  ← runs SYNCHRONOUSLY
 │    └── per variant (embeddings × retrievers):
 │         ├── ingest corpus (data/benchmark/intro.txt) into TMP_DIR scratch dist, timed
 │         ├── build retriever + chat engine (google LLM, buffer memory)
 │         ├── chain.invoke(BENCHMARK_QUESTIONS[0]), timed
 │         └── results_json persisted incrementally
 ├── run.refresh_from_db()
 └── BenchmarkRunResponse
```

### Response 200
```json
{
  "id": 4,
  "name": "emb-vs-retriever",
  "status": "completed",
  "config_json": {
    "config_matrix": {"embeddings": ["openai", "google"], "retrievers": ["base", "cohere_rerank"]},
    "runs": [
      {"embeddings": "openai", "retrievers": "base"},
      {"embeddings": "openai", "retrievers": "cohere_rerank"},
      {"embeddings": "google", "retrievers": "base"},
      {"embeddings": "google", "retrievers": "cohere_rerank"}
    ]
  }
}
```

### Errors
- `422` `{"detail": "config_matrix must not be empty."}`.
- Missing provider keys (e.g. `OPENAI_API` unset) → per-variant `status: "error"` inside
  `results_json.results` (not an HTTP error) with `error` message.
- Unexpected outer failures → benchmark `status: "failed"` (still HTTP 200 with the run,
  since it is created first). Verified — errors are captured on the model, not re-raised.

---

## GET `/api/benchmarks`

### Request
```http
GET /api/benchmarks
```

### Response 200
```json
[
  {
    "id": 4,
    "name": "emb-vs-retriever",
    "status": "completed",
    "config_json": {"config_matrix": {…}, "runs": […]},
    "results_json": {"results": [
      {"embeddings": "openai", "retrievers": "base", "ingestion_ms": 2100.5,
       "query_ms": 3450.1, "source_count": 2, "answer_sample": "…", "status": "ok"}
    ]},
    "created_at": "2026-09-18T…"
  }
]
```

### Errors
None.

---

## GET `/api/benchmarks/{run_id}`

### Request
```http
GET /api/benchmarks/4
```

### Response 200
```json
{
  "id": 4,
  "name": "…",
  "status": "completed",
  "config_json": {…},
  "results_json": {"results": […]},
  "created_at": "…"
}
```

### Errors
- `404` `{"detail": "Benchmark run not found."}`.
- `422` for non-integer `run_id`.

---

## Error-handling summary

| Endpoint | Error shapes (verified) |
| -------- | ----------------------- |
| `/api/health` | none |
| `GET/POST /api/vectorstores` | Pydantic 422 |
| `POST /api/documents` | 422 no files; 500 `Ingestion failed: …` |
| `POST /api/chat` | 404 store missing; 422 invalid enums; 500 provider failures |
| `POST /api/benchmarks` | 422 empty matrix |
| `GET /api/benchmarks/{id}` | 404 not found; 422 bad id |

FastAPI's default 422 body is a validation detail array. The frontend `handle<T>`
helper in `api/client.ts` surfaces `detail` if it is a string, else falls back to
`HTTP <status>`.