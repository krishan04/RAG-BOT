# 13 — Testing

> **Verified: there is no working test infrastructure in this repository.**

## What exists

| Location | Content (verified) |
| -------- | ------------------ |
| `backend/core/tests.py` | `from django.test import TestCase` + `# Create your tests here.` — empty stub |
| `backend/rag/tests.py` | `from django.test import TestCase` + `# Create your tests here.` — empty stub |
| `frontend` | No `*.test.*`, `*.spec.*`, jest/vitest/testing-library deps, no test script in `package.json` |
| Root | No `tests/` package, no `conftest.py`, no `pytest.ini`/`pyproject.toml`/`setup.cfg`/`tox.ini` |
| `Makefile` | **No `test` target** |

Root `.gitignore` lists `.pytest_cache/` and `.ruff_cache/`, suggesting these tools were
intended, but there are no configs or suites present today.

## How to validate changes (currently manual)

Since there are no tests, you verify behavior by running the app and probing the API:

### 1. Boot the stack
```bash
make setup          # one-time
make db             # migrations
make superuser      # optional, for /admin
make dev            # backend :8000 + frontend :5173
```

### 2. Health check
```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","api":"fastapi","django":"5.2.17","version":"0.1.0"}
```

### 3. End-to-end smoke (chat pipeline)
```bash
# needs a populated vectorstore; the repo has data/vector_stores/CV on disk
curl -X POST http://127.0.0.1:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"vector_store":"CV","question":"What does this project do in one sentence?", "llm_provider":"google"}'
```

### 4. Frontend lint + type-check
```bash
cd frontend && npm run lint      # oxlint
cd frontend && npm run build     # tsc -b && vite build (also type-checks)
```

### 5. Python import smoke (catches config/telemetry wiring errors)
```bash
cd backend && ../venv/bin/python -c "import config.asgi"   # boots Django + FastAPI
cd backend && ../venv/bin/python manage.py check           # Django system check
```

## Relationship: source → test

Because no test files map to source files, the "source → test" table is empty by
construction:

| Source file | Test file | Status |
| ----------- | --------- | ------ |
| `backend/fastapi_app/routers/*` | — | none |
| `backend/rag/services/*` | — | none |
| `backend/core/models.py` | — | none |
| `frontend/src/*` | — | none |

## Suggested testing strategy (what to add, if you introduce tests)

| Area | Recommended approach |
| ---- | -------------------- |
| FastAPI endpoints | `pytest + httpx` against `fastapi_app` (need migrations + SQLite) |
| RAG services | Mock the providers/vendors (LangChain clients); assert call order + trace shape |
| `execute_pipeline` | Unit-test with a fake vectorstore + fake LLM; assert trace keys + TTFT callback |
| `build_matrix` | Pure cartesian tests (no deps) |
| Frontend | `vitest` + React Testing Library; mock `fetch` in `api/client.ts` |
| ORM relations | Django `TestCase` / `pytest-django` for CASCADE vs SET_NULL behavior |

## Quick reference: available build/lint commands (verified)

| Command | Runs | Where |
| ------- | ---- | ----- |
| `make setup` | venv + pip install + npm install | root |
| `make db` | Django `migrate` | root |
| `make dev` | backend + frontend dev servers | root |
| `cd frontend && npm run lint` | oxlint | frontend |
| `cd frontend && npm run build` | `tsc -b && vite build` | frontend |
| `cd backend && ../venv/bin/python manage.py check` | Django system checks | backend |