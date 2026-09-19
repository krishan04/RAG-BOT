"""Document ingestion endpoints: upload -> load -> split -> embed -> persist."""

import hashlib
from pathlib import Path

from django.conf import settings
from fastapi import APIRouter, HTTPException, UploadFile

from fastapi_app.schemas import DocumentIngestResponse

router = APIRouter()


@router.post("/documents", response_model=DocumentIngestResponse)
def ingest_documents(
    vector_store: str,
    files: list[UploadFile],
    embedding_provider: str = "openai",
    splitter: str = "recursive",
    chunk_size: int = 1600,
    chunk_overlap: int = 200,
):
    """Ingest uploaded files into a Chroma vectorstore.

    Files are written to the temp dir, loaded/chunked/embedded via the rag
    services, persisted under ``data/vector_stores/<name>`` and recorded in
    Django.
    """
    from core.models import Document, VectorStore
    from rag.services.ingestion import ingest_documents as run_ingestion

    if not files:
        raise HTTPException(status_code=422, detail="No files provided.")

    store, created = VectorStore.objects.get_or_create(
        name=vector_store,
        defaults={
            "embedding_provider": embedding_provider,
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
        },
    )
    store.embedding_provider = embedding_provider
    store.chunk_size = chunk_size
    store.chunk_overlap = chunk_overlap
    store.persist_path = str(settings.VECTOR_STORE_ROOT / vector_store)
    store.save()

    # Stage uploads into the temp dir for the directory loader.
    tmp_dir = settings.TMP_DIR
    tmp_dir.mkdir(parents=True, exist_ok=True)
    for old in tmp_dir.glob("*"):
        try:
            old.unlink()
        except OSError:
            pass

    file_hashes = {}
    for file in files:
        filename = Path(file.filename or "upload").name
        content = file.file.read()
        file_hashes[filename] = hashlib.sha1(content).hexdigest()
        (tmp_dir / filename).write_bytes(content)

    document_count = len(file_hashes)
    try:
        result = run_ingestion(
            tmp_dir=str(tmp_dir),
            splitter_name=splitter,
            embeddings_name=embedding_provider,
            persist_directory=store.persist_path,
            api_keys=settings.API_KEYS,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    except Exception as exc:
        if created:
            store.delete()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc
    finally:
        for old in tmp_dir.glob("*"):
            try:
                old.unlink()
            except OSError:
                pass

    for filename, upload_hash in file_hashes.items():
        Document.objects.update_or_create(
            vector_store=store,
            filename=filename,
            defaults={
                "file_type": filename.rsplit(".", 1)[-1].lower(),
                "upload_hash": upload_hash,
                "chunk_count": result["chunk_count"],
                "status": Document.Status.INGESTED,
            },
        )

    return DocumentIngestResponse(
        vector_store=store.name,
        chunk_count=result["chunk_count"],
        config={
            **result["config"],
            "document_count": document_count,
            "status": "ingested",
        },
    )