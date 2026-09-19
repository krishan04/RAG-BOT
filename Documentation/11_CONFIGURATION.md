# 11 — Configuration

> Every configuration surface in the project, with what it controls and whether it
> is required. **No secret values are reproduced; only variable names.**

---

## 1. Environment variables

All secrets enter via `load_dotenv(PROJECT_ROOT / ".env")` in `backend/config/settings.py:21`.

### Required (in order for the full feature set to work)

| Variable | Read by | Used as | Note |
| -------- | ------- | ------- | ---- |
| `GEMINI_API` | `settings.py` | `API_KEYS["gemini"]` **and** `API_KEYS["google"]` | Maps to **both** "gemini" and "google" keys. Default provider is Google — without this, chat and ingestion fail with a live API probe error. |
| `COHERE_API` | `settings.py` | `API_KEYS["cohere"]` | Required for `retriever: "cohere_rerank"`. Other retriever types work without it. |

### Optional

| Variable | Read by | Used as | Note |
| -------- | ------- | ------- | ---- |
| `OPENAI_API` | `settings.py` | `API_KEYS["openai"]` | Falls back to `""`. Needed if using `llm_provider: "openai"` or `embedding_provider: "openai"`. **Not in current `.env`.** |
| `HF_API` | `settings.py` | `API_KEYS["huggingface"]` | Falls back to `""`. Needed if using HuggingFace. **Not in current `.env`.** |

### Django-specific (optional; defaults exist)

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `DJANGO_SECRET_KEY` | `django-insecure-ro!wp96…` (hardcoded fallback) | Must be set for any non-dev deployment |
| `DJANGO_DEBUG` | `"True"` | Read as string; `"True"` → `True` |
| `DJANGO_ALLOWED_HOSTS` | `"*"` | Comma-separated |
| `DJANGO_SETTINGS_MODULE` | `"config.settings"` | Set automatically in `manage.py`, `asgi.py`, `main.py` |

---

## 2. Application settings (`backend/config/settings.py`)

### Hardcoded paths (verified)

| Setting | Value | Controls |
| ------- | ----- | -------- |
| `BASE_DIR` | `backend/` | Parent for all relative paths |
| `PROJECT_ROOT` | repo root (one up from `backend/`) | `.env` location |
| `STORAGE_DIR` | `backend/storage/` | Uploads + temp staging |
| `TMP_DIR` | `backend/storage/tmp/` | Staging during ingestion + scratch Chroma for benchmarks |
| `VECTOR_STORE_ROOT` | `<repo>/data/vector_stores` | Chroma store root (shared with legacy app) |
| `BENCHMARK_CORPUS_DIR` | `<repo>/data/benchmark` | Fixed corpus for benchmarks |
| `STATIC_ROOT` | `backend/staticfiles/` | Django collectstatic output |

### Hardcoded application constants (verified)

| Setting | Value | Controls |
| ------- | ----- | -------- |
| `BENCHMARK_QUESTIONS` | `["What does this project do in one sentence?", "Which components can be benchmarked?"]` | Benchmark runner queries (only `[0]` actually used) |
| `CORS_ALLOWED_ORIGINS` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | CORS for the FastAPI layer |

### Middleware stack (Django-side)
Only applies to Django-mounted routes (`/admin`, `/static`):
`SecurityMiddleware`, `SessionMiddleware`, `CommonMiddleware`, `CsrfViewMiddleware`,
`AuthenticationMiddleware`, `MessageMiddleware`, `XFrameOptionsMiddleware`.

FastAPI CORS is configured separately in `fastapi_app/main.py`.

---

## 3. Frontend configuration

### `frontend/vite.config.ts`
| Setting | Value | Controls |
| ------- | ----- | -------- |
| `server.port` | `5173` | Vite dev server port |
| `server.proxy["/api"]` | `http://127.0.0.1:8000` | Backend API |
| `server.proxy["/admin"]` | `http://127.0.0.1:8000` | Django admin |
| `server.proxy["/static"]` | `http://127.0.0.1:8000` | Django static |

### `frontend/package.json` scripts
| Script | Command | Purpose |
| ------ | ------- | ------- |
| `dev` | `vite` | Start dev server |
| `build` | `tsc -b && vite build` | Type-check then build `dist/` |
| `lint` | `oxlint` | Lint (no eslint/prettier) |
| `preview` | `vite preview` | Serve `dist/` locally |

### `frontend/.oxlintrc.json`
Plugins: `react`, `typescript`, `oxc`. Rules: `react/rules-of-hooks: "error"`,
`react/only-export-components: ["warn", {"allowConstantExport": true}]`.

### `frontend/tsconfig.app.json`
`noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true` (no
enums). Strict mode **not enabled**.

---

## 4. Makefile / `scripts/dev.sh`

| Tool/Port | Default | How to change |
| --------- | ------- | ------------- |
| Backend | uvicorn on `127.0.0.1:8000` | Edit `Makefile` (`UVICORN` var) or `scripts/dev.sh` (`BACKEND_PORT`) |
| Frontend | Vite on `localhost:5173` | Edit `Makefile` (`FRONTEND_DIR`) or `scripts/dev.sh` (`FRONTEND_PORT`) |
| Python venv | `venv/` at repo root | Edit `Makefile` (`VENV` var) |

---

## 5. Classification

### Required for the app to function
- `GEMINI_API` (default provider is Google; ingestion probe will fail without it).
- `COHERE_API` (only if using Cohere reranker; otherwise not needed).

### Required for production
- `DJANGO_SECRET_KEY` (current hardcoded fallback is insecure).
- `DJANGO_DEBUG=False`.
- `DJANGO_ALLOWED_HOSTS` (specific hosts, not `*`).
- A proper database (not SQLite) for concurrency — not implemented; documented here as
  a future consideration.

### Development defaults (safe to leave as-is in dev)
- Vite proxy targets `http://127.0.0.1:8000`.
- Uvicorn `--reload` (when using `make backend`).
- `DEBUG=True`.

---

## 6. Verified quirks in configuration

1. `GEMINI_API` maps to **both** `API_KEYS["gemini"]` and `API_KEYS["google"]` — setting
   `GEMINI_API` satisfies both keys.
2. `OPENAI_API` and `HF_API` are **not** present in `.env` but are read by the code;
   they silently become `""` (empty string), which causes API errors if you select those
   providers.
3. `DJANGO_SECRET_KEY` hardcoded fallback is only safe for local dev; a production deploy
   must set it.
4. The `DJANGO_MOUNT_PREFIX` setting (`""`) is defined but not referenced in any runtime
   code path (`UNKNOWN / NEEDS VERIFICATION` what it was intended for).