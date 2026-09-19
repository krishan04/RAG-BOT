# 16 — Debugging Guide

> Symptom → where to look → what each file/function is responsible for.
> Every path below follows the actual code structure. When in doubt, start at
> `frontend/src/api/client.ts` (all HTTP flows) and `fastapi_app/main.py` (app wiring).

---

## Symptom 1: Frontend can't reach the backend (network errors)

```text
Browser → Vite :5173 → proxy (vite.config.ts) → 127.0.0.1:8000
```

**Inspect:**
1. Is uvicorn running? `lsof -i tcp:8000` (or `make backend`, `make dev`).
2. Is Vite running? `npm --prefix frontend run dev` (port 5173).
3. Proxy config: `frontend/vite.config.ts` (target `http://127.0.0.1:8000`)
   — a **wrong backend host** here breaks everything. The backend must bind
   `127.0.0.1:8000`, which `scripts/dev.sh` does.
4. `client.ts::handle` — non-2xx throws `Error(detail)`; check browser console.
5. CORS: `backend/config/settings.py` `CORS_ALLOWED_ORIGINS` must contain
   `http://localhost:5173`. A mismatched origin (e.g. `http://0.0.0.0:5173`) → CORS error.

---

## Symptom 2: API returns 500 on chat

```text
POST /api/chat
 ↓ chat.py::chat
 ↓ build_retriever / _build_llms / execute_pipeline
```

**Likely causes (in order of probability):**
1. **Missing/invalid API key.** Check `.env` has the provider key, and it maps to
   `settings.API_KEYS` correctly (`GEMINI_API` → `"google"`). See `11_CONFIGURATION.md`.
2. **Vectorstore missing/invalid persist path.** `store.persist_path` points at
   `data/vector_stores/<name>`; if the dir was deleted, `load_chroma_vectorstore`
   returns an empty store → empty sources, possibly an answer built from nothing.
3. **Provider model wrong for provider.** e.g. google expecting a gemini model string;
   the model text field in `PipelineSettingsPopover` is free-form.
4. **HuggingFace streaming.** `HuggingFaceHub` may not support `.stream(...)`;
   `execute_pipeline` catches `NotImplementedError`/`TypeError` and falls back to
   `invoke(...)` — if that fallback isn't hit, look at `execution.py` Stage 4.

**Inspect files:**
- `backend/fastapi_app/routers/chat.py` (404/500 paths, HTTPException)
- `backend/rag/services/execution.py` (Stage 1-4, fallbacks)
- `backend/rag/services/chatbot.py` (`_build_llms`)
- `backend/config/settings.py` (`API_KEYS`)

---

## Symptom 3: Ingestion fails (500 "Ingestion failed: …")

```text
POST /api/documents
 ↓ ingestion.py::ingest_documents
 ↓ rag/services/ingestion.py::ingest_documents
```

**Likely causes:**
1. Google embeddings **live probe** fails: `rag/embeddings/google.py` calls
   `embed_query("validation test")` at construction — bad/missing `GEMINI_API` fails
   here.
2. Unset `OPENAI_API`/`HF_API` (ignored in `.env`) while selecting those providers.
3. File type unsupported (only txt/pdf/csv/docx in `rag/loaders/directory_loader.py`).
4. `data/vector_stores` not writable; `VECTOR_STORE_ROOT` wrong.

**Inspect files:**
- `backend/fastapi_app/routers/ingestion.py` (rollback + 500 detail)
- `backend/rag/services/ingestion.py` (pipeline)
- `backend/rag/embeddings/*.py` (probe behavior)
- `backend/config/settings.py` (`VECTOR_STORE_ROOT`, `TMP_DIR`)

**Note:** ingestion rolls back a *newly created* `VectorStore` on failure
(`ingestion.py:76-79`); a store that existed before is left but not updated.

---

## Symptom 4: Chat returns answer with no/wrong sources

**Inspect:**
1. `data/vector_stores/<name>/chroma.sqlite3` exists? If not, no embeddings were
   ever persisted.
2. `core_vectorstore` row's `embedding_provider` vs the embedding used at query time:
   **the chat query builds embeddings from `ChatRequest.llm_provider`, not from the
   store's `embedding_provider`** (`chat.py:35-40`). Mixing providers (ingest with
   google, chat with openai) produces mismatched/no matches — verified behavior.
3. Retriever variant: `cohere_rerank`/`contextual_compression` filter/rerank and can
   drop sources (`execution.py` Stage 3, `k_filtered`).
4. Score display: `score_map` keys by `doc.page_content`; duplicates collapse
   (`chat.py:98-113`).

---

## Symptom 5: Trace panel shows no data

**Inspect:**
1. `TraceContext.tsx` — `useTrace()` throws if a consumer is outside `TraceProvider`.
   `App.tsx` wraps everything, so this is normally fine.
2. `ChatCanvas.handleSend` — `setTrace(res.trace)` is what populates it. If the answer
   is generated but trace null, the message object may lack `trace`.
3. `PipelineTrace.tsx` uses `trace` (or `focusTrace`); if the last message has no trace,
   panel is empty (verified: `lastTrace` walks messages backwards).

---

## Symptom 6: Store won't appear in UI after creating it

**Inspect:**
1. `GET /api/vectorstores` — `django` comes from ORM, `persisted` from disk scan
   (`vectorstores.py`). A store created via `POST /api/vectorstores` (or via ingestion)
   shows only if the Chroma dir `data/vector_stores/<name>/chroma.sqlite3` also exists
   for `persisted`; the `django` list is authoritative for the UI lists.
2. `StoresRail` refetch triggers only on `refreshKey` change
   (`ChatWorkspace` passes `onStoresChanged`). After adding via admin (which bypasses
   existing APIs), the UI won't auto-refresh.

---

## Symptom 7: Benchmark runs return status `error`

**Inspect:**
1. `results_json.results[i].error` message in `GET /api/benchmarks/{id}`.
2. Provider keys: a variant with unset provider → status `error`
   (`runner.py` catches exceptions per variant).
3. The corpus: `settings.BENCHMARK_CORPUS_DIR` must exist and contain `intro.txt`.
4. Synchronous execution: a slow/missing provider blocks the whole request — the
   endpoint has no background task (verified). Expect long response times.

---

## Symptom 8: Django admin doesn't work / migrations pending

**Inspect:**
1. `make db` — applies migrations; `backend/db.sqlite3` must exist.
2. `core/admin.py` — all 5 models registered; if you added a model and didn't register
   it, it silently won't appear.
3. Superuser: `make superuser`.
4. Remember: admin is served at `http://127.0.0.1:8000/admin` **through WSGI mount**
   (Django behind FastAPI). A broken `WSGIMiddleware` mount in `main.py` knocks out
   both admin and static.

---

## Symptom 9: "Magic" errors at import / startup

```text
backend/fastapi_app/main.py  imports config.asgi  →  django.setup() → core.models imports
```

- Any exception during startup is usually a Django/DB issue: check
  `python manage.py check` and that `backend/db.sqlite3` exists (created by `make db`).
- `config/settings.py` reads `.env` — a malformed `.env` causes missing keys
  (silent `""`), not a crash.
- If `data/vector_stores` or `backend/storage/tmp` are missing, `core/models.py:141-143`
  recreates them at import — only a filesystem permission problem would surface.

---

## Symptom 10: Lint / type errors after editing frontend

- `cd frontend && npm run lint` (oxlint) — `.oxlintrc.json`.
- `cd frontend && npm run build` — `tsc -b && vite build`.
- `tsconfig.app.json` sets `noUnusedLocals`/`noUnusedParameters` — unused imports fail
  the build. `erasableSyntaxOnly` means **no TS enums** — use string unions as in
  `models.ts`.

---

## Symptom 11: Frontend shows a store list but chat always says pick a base

- `ChatWorkspace` holds `selectedStore` and passes it to `ChatCanvas`. If it is null
  (first render), the send button shows "Select a knowledge base first"
  (`ChatCanvas.tsx`).
- Ensure `StoresRail.onSelectStore` is wired to `setSelectedStore`.

---

## Symptom 12: Session/message rows are duplicated per request

- This is by design: every chat request creates a **new** `ChatSession`
  (`chat.py:62-68`) plus two `Message` rows. There is no conversation continuity.
  If you expected multi-turn memory, that is a missing feature, not a bug
  (`14_EXECUTION_FLOW.md` §4).

---

## Environment / config quick checksheet

| Check | Command / file |
| ----- | -------------- |
| Backend alive | `curl http://127.0.0.1:8000/api/health` |
| Vite proxy | `frontend/vite.config.ts` |
| API keys set | `.env` names: `GEMINI_API`, `COHERE_API` (only these two present) |
| DB migrated | `make db` |
| Chroma stores on disk | `ls data/vector_stores/` |
| Backend logs | terminal running `scripts/dev.sh` / `make backend` |
| Django check | `cd backend && ../venv/bin/python manage.py check` |