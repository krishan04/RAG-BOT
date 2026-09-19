"""Service orchestration: document ingestion pipeline.

Order: load -> split -> embed -> persist into a vectorstore.
The loader step is optional: pass ``documents`` directly or let the loader
read a directory via the registry.
"""


def load_documents(tmp_dir: str = ""):
    """Load all documents under ``tmp_dir`` using the directory loader."""
    from rag.loaders import get_loader

    load = get_loader("directory")(tmp_dir=tmp_dir)
    return load()


def ingest_documents(
    documents=None,
    tmp_dir: str = "",
    splitter_name: str = "recursive",
    embeddings_name: str = "openai",
    vectorstore_name: str = "chroma",
    persist_directory: str = "",
    api_keys: dict | None = None,
    chunk_size: int = 1600,
    chunk_overlap: int = 200,
):
    """Ingest documents into a vectorstore using the named component variants.

    Returns a dict with ``vectorstore``, ``chunk_count`` and the used config.
    """
    from rag.embeddings import get_embeddings_factory
    from rag.splitters import get_splitter
    from rag.vectorstores import get_vectorstore_factory

    if documents is None:
        documents = load_documents(tmp_dir)

    api_keys = api_keys or {}
    splitter = get_splitter(splitter_name)(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap
    )
    embeddings = get_embeddings_factory(embeddings_name)(
        api_key=api_keys.get(embeddings_name, "")
    )

    chunks = splitter.split_documents(documents)
    create = get_vectorstore_factory(vectorstore_name)(embeddings, persist_directory)
    vectorstore = create(chunks)

    return {
        "vectorstore": vectorstore,
        "chunk_count": len(chunks),
        "config": {
            "splitter": splitter_name,
            "embeddings": embeddings_name,
            "vectorstore": vectorstore_name,
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
        },
    }