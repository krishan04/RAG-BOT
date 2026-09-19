"""Vectorstore management endpoints."""

from django.conf import settings
from fastapi import APIRouter, HTTPException

from fastapi_app.schemas import VectorStoreCreate

router = APIRouter()


@router.get("/vectorstores")
def list_vectorstores():
    """List known vectorstores (Django records + persisted Chroma dirs)."""
    from django.db.models import Count
    from core.models import VectorStore
    from rag.vectorstores import list_vectorstores

    records = list(
        VectorStore.objects.annotate(
            document_count=Count("documents")
        ).values(
            "id",
            "name",
            "embedding_provider",
            "persist_path",
            "chunk_size",
            "chunk_overlap",
            "created_at",
            "document_count",
        )
    )
    persisted = [
        item.name
        for item in sorted(settings.VECTOR_STORE_ROOT.iterdir())
        if item.is_dir()
        and not item.name.startswith(".")
        and (item / "chroma.sqlite3").exists()
    ] if settings.VECTOR_STORE_ROOT.exists() else []

    return {
        "django": records,
        "persisted": persisted,
        "engine_variants": list_vectorstores(),
    }


@router.post("/vectorstores")
def create_vectorstore(payload: VectorStoreCreate):
    """Persist a vectorstore record in Django."""
    from core.models import VectorStore

    store, created = VectorStore.objects.get_or_create(
        name=payload.name,
        defaults={
            "embedding_provider": payload.embedding_provider.value,
            "persist_path": str(settings.VECTOR_STORE_ROOT / payload.name),
        },
    )
    return {"id": store.id, "name": store.name, "created": created}