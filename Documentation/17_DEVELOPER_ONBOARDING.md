# 17 — Developer Onboarding

> A progressive path from "never seen this repo" to "can modify it confidently",
> plus change-impact analysis and the standard start-here answers.

---

## Step 1 — Understand (Day 1)

Read in this order:

1. `00_PROJECT_OVERVIEW.md` — what the app is, high-level diagram.
2. `01_REPOSITORY_STRUCTURE.md` — where everything lives.
3. `02_ARCHITECTURE.md` — the registry + service pattern (the single most important
   concept).
4. `10_AUTHENTICATION.md`, `11_CONFIGURATION.md` — what's configured and what's open.

Then read the actual heart files in the editor:
- `backend/config/asgi.py` + `backend/fastapi_app/main.py` (boot + wiring)
- `backend/config/settings.py` (config)
- `backend/core/models.py` (data)
- `frontend/src/views/ChatWorkspace.tsx`, `frontend/src/api/client.ts` (UI→API bridge)

## Step 2 — Follow (Day 2)

Trace one full feature end-to-end using `07_API_PIPELINE.md` (especially
`pipelines/chat.md`):

```text
ChatCanvas.handleSend → sendChat → POST /api/chat
→ chat.py::chat → execute_pipeline (condense/search/rerank/synthesize)
→ Message/ChatSession ORM rows → ChatResponse → TraceContext → PipelineTrace
```

Repeat for ingestion (`pipelines/ingestion.md`) and benchmarks
(`pipelines/benchmarks.md`). Open each file listed; read the function the arrow points to.

## Step 3 — Modify small, safe things (Day 3)

1. Change the **answer prompt** text: `backend/rag/prompts/answer.py`
   (`answer_template`). Restart backend, ask a question, see the answer style change.
2. Change the **trace panel** label or colors: `frontend/src/components/telemetry/PipelineTrace.tsx`.
3. Change a **default constant** (e.g. `k` in `backend/fastapi_app/routers/chat.py`).
4. Add an env var to `.env` and read it in `settings.py`.

Each is one file, no cross-cutting risk. Verify with `curl` (chat) and browser refresh.

## Step 4 — Debug an existing issue (Day 4)

Pick a symptom from `16_DEBUGGING_GUIDE.md` (e.g. "Chat returns 500"). Reproduce it,
then walk the pipeline:

```text
Network tab → POST /api/chat status
↓ 500
chat.py → which line raised? (404 check, provider call, execute_pipeline)
execute_pipeline → Stage 1-4 timings in GET trace
settings.API_KEYS → is the provider key present?
```

Add temporary `print()`/`logger` lines in `execute_pipeline` or `_build_llms` if the
stack trace isn't enough — uvicorn prints to the terminal running `make dev`.

## Step 5 — Implement a small feature (Day 5-6)

The canonical example: **add a new retriever variant** (uses the registry pattern).

1. Create `backend/rag/retrievers/my_retriever.py` with a `create_my_retriever(...)`
   factory following `cohere_rerank.py`'s shape (return a retriever that exposes
   `.base_compressor`).
2. Register it: add `"my_retriever": my_retriever.create_my_retriever` to the
   `_REGISTRY` dict in `backend/rag/retrievers/__init__.py`.
3. Add the name to the enum `RetrieverName` in
   `backend/fastapi_app/schemas.py` and the union type in `frontend/src/models.ts`.
4. Add the option to `PipelineSettingsPopover.tsx` and/or `BenchmarksLab.tsx`
   (for benchmarking).
5. `backend/rag/services/retrieval.py::build_retriever` already dispatches any
   registered name (non-cohere non-base falls to the `else` branch — pass `embeddings`).
6. Run: `make dev`, test chat with retriever `"my_retriever"`, then a benchmark run.

## Change-impact analysis (verified from the graphs)

### "If I change `backend/rag/embeddings/__init__.py` (add a provider)"
```text
Potentially affected:
├── rag/services/ingestion.py (ingest_documents uses the registry)
├── rag/services/chatbot.py (…only indirectly via providers)
├── fastapi_app/routers/chat.py (get_embeddings_factory call)
├── fastapi_app/routers/ingestion.py (embedding_provider param)
├── rag/benchmarks/runner.py (benchmark variants)
├── core/models.py (VectorStore.embedding_provider choices — add a new choice)
└── frontend/src/models.ts (EmbeddingProvider union)
API: POST /api/chat, /api/documents
Feature: Document Ingestion, Chat, Benchmark
```

### "If I change `backend/core/models.py` (add a field)"
```text
Potentially affected:
├── backend/core/migrations/*  (must run makemigrations + migrate)
├── backend/core/admin.py       (show the field in admin?)
├── backend/fastapi_app/schemas.py (expose via API?)
├── backend/fastapi_app/routers/*.py (queries/values lists)
├── frontend/src/models.ts + components (if surfaced in UI)
└── rag/benchmarks/runner.py (if BenchmarkRun/VectorStore touched)
API: any of the 8 endpoints that serialize that model
```

### "If I change `frontend/src/api/client.ts`"
```text
Potentially affected:
├── ChatCanvas.tsx (sendChat)
├── IngestionModal.tsx (uploadDocuments)
├── StoresRail.tsx / StoresView.tsx (getVectorStores)
├── BenchmarksLab.tsx (runBenchmark/listBenchmarks)
├── NavRail.tsx (getHealth)
└── backend routers (request/response shapes must match)
```

### "If I change `frontend/src/components/telemetry/PipelineTrace.tsx`"
```text
Potentially affected:
├── TraceContext.tsx (trace/focusTrace semantics)
├── ChatCanvas.tsx (setTrace)
├── MessageBubble.tsx / SourceBadge.tsx (focus interaction)
└── ExecutionTrace shape in frontend/src/models.ts (must match backend trace dict)
```

## Start-here answers

### "I need to change the login logic. Where do I start?"
There is no app login — see `10_AUTHENTICATION.md`. If you mean Django admin login,
that's Django's built-in `django.contrib.auth` + `core/admin.py`; no custom code exists.

### "I need to add a new API. Which files should I create/change?"
1. `backend/fastapi_app/schemas.py` — Pydantic model(s).
2. `backend/fastapi_app/routers/<new>.py` — `router = APIRouter()` + handler(s).
3. `backend/fastapi_app/main.py` — `app.include_router(<new>.router, prefix="/api",
   tags=[...])`.
4. If it touches ORM data: `backend/core/models.py` (field/model) + migrations.
5. `frontend/src/models.ts` — matching TS types.
6. `frontend/src/api/client.ts` — a `fetch` method.
7. A UI component to call it.

### "I need to modify the database. What else will be affected?"
See `09_DATABASE.md` §8. Model edits → migrations; schema changes must be mirrored in
`fastapi_app/schemas.py`, `frontend/src/models.ts`, and any router `.values(...)` lists;
admin needs a registration step; cascade behavior is defined by FK `on_delete`.

### "I need to change the frontend UI. How do I find the backend API?"
Look at `frontend/src/api/client.ts` — every endpoint is there. Trace usage: grep the
client method name (e.g. `sendChat`) in `frontend/src/**`; the component calling it is
the one whose UI action triggers that API. Then open the matching router:
`frontend/src/api/client.ts` method → URL → `backend/fastapi_app/routers/<name>.py`.

### "An API is returning the wrong data. Where should I debug?"
1. Check the response against `06_API_DOCUMENTATION.md` (expected shape).
2. Router handler in `backend/fastapi_app/routers/<name>.py` — see what ORM query it
   runs (`.values(...)`, filters).
3. For chat specifically: `execute_pipeline` trace + `chat.py` source building.
4. For vectorstores specifically: remember `django` vs `persisted` are two different
   sources (`vectorstores.py`).

### "I need to add a new feature. What is the expected development flow?"
1. Decide where it lives (frontend-only / API-only / full-stack).
2. Backend: schema → router → main.py mount → optional model change + migration.
3. Registry: if it's a RAG component variant, add a factory + register it
   (`15_FEATURE_MAP.md` §12).
4. Frontend: types → client method → component → verify with Vite proxy.
5. Test manually via `curl` + browser; no automated tests exist yet (`13_TESTING.md`).

### "I want to understand this repository in one week. What should I study each day?"
| Day | Focus | Docs + files |
| --- | ----- | ------------ |
| 1 | Orientation / boot | `00` → `01` → `02`; `config/asgi.py`, `fastapi_app/main.py`, `settings.py` |
| 2 | Data + API | `09_DATABASE.md`, `06_API_DOCUMENTATION.md`; `core/models.py`, `schemas.py` |
| 3 | RAG engine | `files/backend-rag-engine.md`, `05_FUNCTION_GRAPH.md`; `rag/services/*.py` |
| 4 | Chat feature deep dive | `pipelines/chat.md`, `08_DATA_FLOW.md`; `components/chat/*`, `TraceContext.tsx` |
| 5 | Ingestion + benchmarks | `pipelines/ingestion.md`, `pipelines/benchmarks.md`; `runner.py`, `directory_loader.py` |
| 6 | Frontend + telemetry | `files/frontend.md`; `ChatCanvas.tsx`, `PipelineTrace.tsx`, `ui/*` |
| 7 | Modify + debug practice | Do Steps 3-4 above; read `16_DEBUGGING_GUIDE.md` |