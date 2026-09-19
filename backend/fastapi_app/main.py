"""FastAPI applications is a Django-RAG backend, mounted alongside Django in one ASGI process.

uvicorn config.asgi:application --reload
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.core.wsgi import get_wsgi_application  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.middleware.wsgi import WSGIMiddleware  # noqa: E402

from fastapi_app.routers import benchmarks, chat, health, ingestion, vectorstores  # noqa: E402

# Build the Django WSGI app first (root mounts must not shadow /api routes).
django_wsgi = get_wsgi_application()

app = FastAPI(
    title="RAG Bot API",
    description="FastAPI REST layer for the RAG engine (Django monolith).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(ingestion.router, prefix="/api", tags=["ingestion"])
app.include_router(vectorstores.router, prefix="/api", tags=["vectorstores"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(benchmarks.router, prefix="/api", tags=["benchmarks"])

# Mount Django (admin, static, auth) at the root *after* /api routes so the
# FastAPI routes take precedence.
app.mount("/", WSGIMiddleware(django_wsgi))