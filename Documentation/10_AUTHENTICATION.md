# 10 — Authentication

> **Short answer: there is no application authentication.** Verified by reading the
> entire FastAPI layer and Django config: the REST API is completely open.

## What exists

| Concern | Status (verified) | Evidence |
| ------- | ----------------- | -------- |
| API authentication (login, JWT, bearer tokens, session auth) | **NONE** | All 8 FastAPI handlers have no `Depends`, no auth middleware, no guards (`backend/fastapi_app/routers/*.py`) |
| API authorization / roles / permissions | **NONE** | No role/permission checks anywhere in the API |
| Django admin login | **YES** (Django's built-in auth) | `INSTALLED_APPS` includes `django.contrib.auth`, middleware includes `AuthenticationMiddleware`, `config/urls.py` mounts `path('admin/', admin.site.urls)` |
| CORS restriction | Partial | Only `http://localhost:5173` + `http://127.0.0.1:5173` allowed (`settings.CORS_ALLOWED_ORIGINS`) |
| CSRF | Django-side only | `CsrfViewMiddleware` applies only to Django routes (admin forms), not FastAPI |

## The full "auth flow" (it is just Django admin)

```text
http://127.0.0.1:8000/admin
 ↓
Django admin login page  (sessions + auth middleware)
 ↓
credentials verified against django.contrib.auth User table
 ↓
session cookie
 ↓
admin UI (core/admin.py registrations)
```

Password validation validators are configured in
`backend/config/settings.py:88-93` (Django defaults). A superuser is created once via
`make superuser`.

## API endpoints and protection

| Endpoint | Protected? |
| -------- | ---------- |
| `GET /api/health` | No |
| `GET/POST /api/vectorstores` | No |
| `POST /api/documents` | No |
| `POST /api/chat` | No |
| `POST/GET /api/benchmarks`, `GET /api/benchmarks/{id}` | No |

Any process that can reach port `8000` can ingest documents, query the stores, and run
LLM-billed benchmarks. In dev the port binds to `127.0.0.1` (`scripts/dev.sh`).

## Secrets (not auth) — how keys are managed

Provider keys are **not** attached to users; there is a single shared key map:

```text
.env  →  load_dotenv(PROJECT_ROOT/".env")  →  settings.API_KEYS
    GEMINI_API  → API_KEYS["gemini"] and API_KEYS["google"]
    COHERE_API  → API_KEYS["cohere"]
    OPENAI_API  → API_KEYS["openai"]   (unset currently)
    HF_API      → API_KEYS["huggingface"]  (unset currently)
```

`rag/` reads keys only from the `api_keys` dict passed in; routers read
`settings.API_KEYS`.

## Roadmap signal

The README's **Phase 4** lists "auth/tenants" as a future item — confirming there is no
auth today. No facility is partially implemented.

## Consequences / what to watch for

1. Anyone who can reach the API can spend your provider quota (LLM calls are not
   rate-limited or keyed per-user).
2. Schema of `ChatSession`/`Message`/`VectorStore` has **no user/owner field** today; a
   tenant model would be a breaking change (see `09_DATABASE.md` for the current FK
   shape).
3. If you add auth, the natural integration points are: a FastAPI dependency (see
   `fastapi_app/dependencies.py`, currently unused) and a middleware — nothing today
   blocks that path.