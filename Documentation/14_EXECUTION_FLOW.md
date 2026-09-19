# 14 — Execution Flow

> What happens from process start to request handling, and the important runtime flows.

---

## 1. Backend startup (uvicorn)

```text
make dev  (or scripts/dev.sh)
 │
 ▼
venv/bin/uvicorn config.asgi:application --host 127.0.0.1 --port 8000   [cwd=backend/]
 │
 ▼
backend/config/asgi.py
 ├── os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
 └── from fastapi_app.main import app      ← imports the FastAPI app
      │
      ▼
backend/fastapi_app/main.py
 ├── os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
 ├── import django; django.setup()         ← initializes Django (settings, apps, DB)
 ├── from django.conf import settings      ← loads settings, .env, API_KEYS, paths
 ├── django_wsgi = get_wsgi_application()  ← builds Django WSGI app for mounting
 ├── app = FastAPI(...)
 ├── app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ALLOWED_ORIGINS, ...)
 ├── app.include_router(health/ingestion/vectorstores/chat/benchmarks, prefix="/api")
 └── app.mount("/", WSGIMiddleware(django_wsgi))   ← Django under everything not /api
      │
      ▼
django.setup() imports core.models  →  STORAGE_DIR / VECTOR_STORE_ROOT / TMP_DIR are
                                       created on disk (core/models.py:141-143)
                                       
uvicorn serves app on 127.0.0.1:8000
```

### Key ordering facts (verified)
- `django.setup()` runs **once** at import time, before any request.
- Routes are added in this order: `/api/health`, `/api/documents` (ingestion),
  `/api/vectorstores`, `/api/chat`, `/api/benchmarks` — **before** Django's `/` mount,
  so `/api/*` always wins.
- The Django WSGI mount handles everything else: `/admin/*`, `/static/*`.

---

## 2. Frontend startup

```text
npm run dev  (Vite, port 5173)
 │
 ▼
frontend/index.html → loads frontend/src/main.tsx
 │
 ▼
main.tsx
 ├── imports fonts + index.css (Tailwind v4 theme)
 ├── createRoot(document.getElementById("root"))
 └── <StrictMode><BrowserRouter><App/></BrowserRouter>
      │
      ▼
App.tsx
 ├── <TraceProvider>          ← global trace/focus state
 ├── <NavRail/>               ← navigation + health pill (getHealth())
 └── <Routes>
      ├── /          → <ChatWorkspace/>   (StoresRail + ChatCanvas + PipelineTrace)
      ├── /stores    → <StoresView/>
      ├── /benchmarks→ <BenchmarksLab/>
      └── *          → <Navigate to="/"/>
```

---

## 3. Runtime flows (short form)

### Ingestion flow
```text
IngestionModal → uploadDocuments() → POST /api/documents →
ingestion.py::ingest_documents →
rag/services/ingestion.py::ingest_documents:
   load → split → embed → Chroma.from_documents (persist) →
VectorStore + Document ORM rows →
response → modal closes → StoresRail refetch (refreshKey++)
```

### Chat flow
```text
ChatCanvas::handleSend → sendChat() → POST /api/chat →
chat.py::chat:
   404 check → embeddings → load Chroma → build_retriever → _build_llms → memory →
   ChatSession + user Message rows →
   execute_pipeline (condense → search → rerank → stream+TTFT) →
   memory.save_context → assistant Message row (sources_json, trace_json) →
   ChatResponse →
ChatCanvas.setState → MessageBubble (markdown) + SourceBadge row
TraceContext.setTrace → PipelineTrace renders 4-stage panel
```

### Benchmark flow
```text
BenchmarksLab → runBenchmark({config_matrix}) → POST /api/benchmarks →
benchmarks.py::create_benchmark:
   build_matrix → BenchmarkRun row →
   runner.run_benchmark (synchronous):
      per variant: timed ingest_documents → build_chat_engine → chain.invoke →
      incremental results_json →
   status COMPLETED/FAILED →
BenchmarkRunResponse → BenchmarksLab refreshes GET /api/benchmarks
```

---

## 4. Important subtlety: stateless chat

Every `POST /api/chat` creates a **new** `ChatSession` and a fresh in-memory memory
object. The `chat_history` passed to the condense step is always empty because memory is
constructed per-request (`chat.py:57-73`). So:
- Each request answers one question with no conversational memory of previous requests.
- `Memory` types (`buffer`/`summary`) currently affect only the (empty) history shape and
  the summary memory constructor.
- Conversations *are* persisted as `ChatSession` + `Message` rows, but nothing replays
  them back into the chain. `UNKNOWN / NEEDS VERIFICATION` whether this is intentional
  (the UI also discards conversation on store switch).

---

## 5. Process/PID topology in dev

| Process | Command | Port | Started by |
| ------- | ------- | ---- | ---------- |
| Backend | uvicorn `config.asgi:application` | 8000 | `scripts/dev.sh` (or `make backend`) |
| Frontend | Vite | 5173 | `scripts/dev.sh` (or `make frontend`) |
| Django CLI | `manage.py` commands | — | `make db/superuser/...` |
| Legacy | `streamlit run RAG_app.py` | 8501 (default) | manual only |