# files/backend-config-core.md — Django project + core app

> Covers: `manage.py`, `config/`, `core/`, migrations, `requirements.txt`.

---

## `backend/manage.py`

### Purpose
Standard Django CLI entry point (`manage.py <cmd>`).

### Why it exists
Runs `migrate`, `makemigrations`, `createsuperuser`, `runserver`, shell, etc.

### Imports / exports
- Imports: `os`, `sys`. Lazy-imports `django.core.management` inside `main()`.
- `main()` sets `DJANGO_SETTINGS_MODULE=config.settings`, calls
  `execute_from_command_line(sys.argv)`.
- Runs `main()` under `if __name__ == "__main__":`.

### Beginner explanation
The standard Django boilerplate. The Makefile calls it (e.g. `make db`).

### Modification guide
Generally never. It is scaffolding.

---

## `backend/config/settings.py` — **CORE**

### Purpose
Single source of truth for Django + monolith configuration.

### Why it exists
Every process reads it: `django.setup()` (FastAPI), `django-admin`, `manage.py`, uvicorn.

### Imports
```
settings.py
 ├── imports → os, pathlib.Path   (stdlib)
 ├── imports → dotenv.load_dotenv (python-dotenv)
 └── imports → (Django internals referenced by string names)
```

### Key settings (verified)
| Setting | Value / default | Notes |
| ------- | --------------- | ----- |
| `BASE_DIR` | `backend/` | |
| `PROJECT_ROOT` | repo root | `.env` loaded from here (settings.py:21) |
| `SECRET_KEY` | env `DJANGO_SECRET_KEY` or hardcoded dev fallback | fallback is insecure — production must set it |
| `DEBUG` | env `DJANGO_DEBUG` (default `"True"`) | **Defaults to True** |
| `ALLOWED_HOSTS` | env `DJANGO_ALLOWED_HOSTS` (default `"*"`) | |
| `INSTALLED_APPS` | Django defaults + `core`, `rag` | rag has no models |
| `MIDDLEWARE` | Django defaults (incl. csrf, auth, sessions) | Only applies to Django-mounted routes |
| `DATABASES` | SQLite at `BASE_DIR / "db.sqlite3"` | |
| `ASGI_APPLICATION` | `config.asgi.application` | |
| `STORAGE_DIR` | `backend/storage` | uploads + tmp |
| `VECTOR_STORE_ROOT` | `<repo>/data/vector_stores` | Chroma root |
| `BENCHMARK_CORPUS_DIR` | `<repo>/data/benchmark` | |
| `BENCHMARK_QUESTIONS` | 2 strings about the project | |
| `TMP_DIR` | `backend/storage/tmp` | ingestion staging + benchmark scratch |
| `API_KEYS` | dict from env: `gemini`/`google`←`GEMINI_API`, `cohere`←`COHERE_API`, `openai`←`OPENAI_API`, `huggingface`←`HF_API` | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173`, `http://127.0.0.1:5173` | React dev server |
| `DJANGO_MOUNT_PREFIX` | `""` | unused-ish (documented, referenced) |

### Beginner explanation
The "brain" of the backend config. If a path or key is wrong, pipelines fail downstream.

### Modification guide
Change when: adding a new storage root, new env key, DB engine, allowed CORS origin,
or production hardening (DEBUG=False, real SECRET_KEY).

---

## `backend/config/asgi.py` — **CORE**

### Purpose
The real backend entry point. Exports `application`.

### Code (verified, line-by-line)
```python
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
from fastapi_app.main import app  # noqa: E402
application = app
```

### Why it exists
Something must tell uvicorn what to serve. `uvicorn config.asgi:application` → this file.

### Imports / exports
- `config/asgi.py → backend/fastapi_app/main.py` (the FastAPI app object).
- Exports `application` = the FastAPI app.

### Beginner explanation
Uvicorn loads the FastAPI app here; `fastapi_app/main.py` then mounts Django inside it.

### Modification guide
Only if the entry point strategy changes.

---

## `backend/config/urls.py`

### Purpose
Django URLconf. Contains only:
```python
urlpatterns = [path('admin/', admin.site.urls)]
```
Django `includes` nothing else because all REST routes live in FastAPI.

### Modification guide
Add Django-side (traditional) views here if ever added — currently there are none.

---

## `backend/config/wsgi.py`

### Purpose
WSGI entry (`application = get_wsgi_application()`). Exists for classic Django servers;
the project's own run path uses ASGI (`config/asgi.py`). `backend/fastapi_app/main.py`
also calls `get_wsgi_application()` to build the Django WSGI app it mounts.

### Modification guide
Rarely. It is scaffolding.

---

## `backend/core/models.py` — **CORE**

### Purpose
Defines the 5 persisted entities driven by the monolith.

### Imports
```text
core/models.py
 ├── imports → django.conf.settings
 └── imports → django.db.models
```

### Important classes (all verified)

#### `VectorStore`
A persisted vectorstore (one Chroma directory).
- Fields: `name` (unique, 255), `persist_path` (1024, blank), `embedding_provider`
  (`openai`/`google`/`huggingface`, default `openai`), `chunk_size` (default 1600),
  `chunk_overlap` (default 200), `created_at`, `updated_at`.
- Ordering: `-created_at`.
- Dependents: `Document.vector_store` (CASCADE, related `documents`),
  `ChatSession.vector_store` (SET_NULL, related `sessions`).

#### `Document`
A document ingested into a vectorstore.
- Fields: `vector_store` FK (CASCADE, related `documents`), `filename` (1024),
  `file_type` (16, blank), `upload_hash` (64 sha1 hex), `chunk_count`, `status`
  (`pending`/`processing`/`ingested`/`failed`, default `pending`), `created_at`,
  `updated_at`.

#### `ChatSession`
A conversation attached to a vectorstore, an LLM config, and a retriever type.
- Fields: `title`, `language` (default `english`), `vector_store` FK (SET_NULL,
  related `sessions`), `llm_provider`, `model`, `retriever_type`, timestamps.

#### `Message`
One chat message inside a session.
- Fields: `session` FK (CASCADE, related `messages`), `role`
  (`user`/`assistant`/`system`), `content` (TextField), `sources_json` (JSON default
  `[]`), `trace_json` (JSON default `{}`), `created_at`.
- The `trace_json` + `sources_json` persist the per-answer trace/source metadata the UI
  shows (see `07_API_PIPELINE.md` → chat).

#### `BenchmarkRun`
One persisted benchmark execution.
- Fields: `name`, `config_json` (matrix + computed runs), `status`
  (`pending`/`running`/`completed`/`failed`), `started_at`, `finished_at`,
  `results_json`, `created_at`.

### Module side effect (verified)
```python
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_STORE_ROOT.mkdir(parents=True, exist_ok=True)
settings.TMP_DIR.mkdir(parents=True, exist_ok=True)
```
Any process importing `core.models` creates the runtime directories.

### Beginner explanation
The ORM layer maps to SQLite tables `core_vectorstore`, `core_document`,
`core_chatsession`, `core_message`, `core_benchmarkrun`. See `09_DATABASE.md`.

### Modification guide
Add a field/table here → then `makemigrations` + `migrate` (via Makefile), update
`admin.py` if you want it in the admin, and update any API schemas that expose it.

---

## `backend/core/admin.py`

### Purpose
Registers all 5 models in the Django admin.

### Classes (verified)
| Admin class | list_display | extras |
| ----------- | ------------ | ------ |
| `VectorStoreAdmin` | name, embedding_provider, created_at | search: name |
| `DocumentAdmin` | filename, vector_store, status, chunk_count, created_at | filter: status, file_type; search: filename |
| `ChatSessionAdmin` | title, vector_store, llm_provider, model, created_at | — |
| `MessageAdmin` | session, role, created_at | filter: role |
| `BenchmarkRunAdmin` | name, status, created_at, finished_at | filter: status |

### Modification guide
Add/remove model registrations when models change.

---

## `backend/core/apps.py`, `views.py`, `tests.py`

- `apps.py`: `CoreConfig(AppConfig)` with `name = "core"`.
- `views.py`: empty stub (`# Create your views here.`).
- `tests.py`: empty stub (`from django.test import TestCase` + comment). **No tests.**

## Migrations

### `core/migrations/0001_initial.py`
Creates `BenchmarkRun`, `ChatSession`, `VectorStore`, `Message`, `Document`, and the
`ChatSession.vector_store` FK (SET_NULL). Generated by Django 5.2.

### `core/migrations/0002_message_trace_json_vectorstore_chunk_overlap_and_more.py`
Adds `Message.trace_json`, `VectorStore.chunk_size` (1600), `VectorStore.chunk_overlap`
(200). These defaults match the legacy `RAG_app.py` splitter constants exactly.

### Modification guide
Regenerate with `make makemigrations` + `make migrate` after model changes. Do not hand-edit.

---

## `backend/requirements.txt`

### Purpose
Fully pinned (`==`) Python deps (177 packages).

### Headline direct dependencies (verified)
- Web: `django==5.2.17`, `fastapi==0.109.2`, `uvicorn==0.27.1`, `starlette==0.36.3`,
  `python-multipart==0.0.32`
- LangChain: `langchain==0.1.4`, `langchain-community==0.0.15`,
  `langchain-core==0.1.16`, `langchain-openai==0.0.2.post1`,
  `langchain-google-genai==0.0.6`
- Providers: `openai==1.8.0`, `google-generativeai==0.3.2`, `cohere==4.47`,
  `huggingface-hub==0.20.3`, `tiktoken==0.5.2`
- Vector: `chromadb==0.4.22`, `chroma-hnswlib==0.7.3`
- Loaders: `pypdf==4.0.1`, `docx2txt==0.8`
- Env: `python-dotenv==1.0.1`
- Legacy UI: `streamlit==1.28.0`, `pandas==2.2.0` (kept for `RAG_app.py`)
- Transitive pulls noticed: opentelemetry fastapi instrumentation, kubernetes,
  pulsar-client, posthog (from chromadb/langsmith ecosystem).

### Beginner explanation
Pinned versions = reproducible environment. **LangChain is pinned to the 0.1.x API
surface** — code uses `langchain.chains.ConversationalRetrievalChain`,
`langchain.text_splitter`, etc., which changed in later LangChain versions.

### Modification guide
Add/upgrade deps deliberately; keep versions pinned. If upgrading LangChain, expect the
`rag/` code (pre-0.2 APIs) to need changes.