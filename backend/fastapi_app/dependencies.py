"""Shared dependencies for FastAPI routers."""

from django.conf import settings


def api_keys() -> dict[str, str]:
    """Return the API keys loaded from .env via Django settings."""
    return dict(settings.API_KEYS)


def db():
    """Minimal database session access for endpoint handlers."""
    from django.db import connection

    return connection