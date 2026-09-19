"""ASGI entrypoint for the RAG Bot monolith.

The FastAPI app is the top-level ASGI application. Django's WSGI app is mounted
at the root so the Django admin stays accessible, while ``/api/*`` routes are
served by FastAPI. Run with::

    uvicorn config.asgi:application --reload
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from fastapi_app.main import app  # noqa: E402

application = app