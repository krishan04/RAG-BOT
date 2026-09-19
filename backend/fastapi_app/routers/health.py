"""Health check endpoint."""

from fastapi import APIRouter

from fastapi_app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health():
    """Liveness probe proving Django + FastAPI are wired in one process."""
    from django.conf import settings
    from django import get_version

    return HealthResponse(
        status="ok",
        api="fastapi",
        django=get_version(),
        version="0.1.0",
    )