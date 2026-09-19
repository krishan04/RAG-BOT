"""Service orchestration: retriever construction + explicit rerank stage.

Chooses a retriever variant via the registry:
base / contextual_compression / cohere_rerank.

Also exposes the compressor so the execution pipeline can run the rerank /
compression stage explicitly (and time it) rather than inside a chain.
"""


def build_retriever(
    vectorstore,
    embeddings=None,
    retriever_name: str = "base",
    api_keys: dict | None = None,
):
    """Build a retriever from an existing vectorstore.

    Returns the configured retriever, the base retriever it wraps, and the
    document compressor (``None`` for the base variant).
    """
    from rag.retrievers import get_retriever_factory

    api_keys = api_keys or {}
    base = get_retriever_factory("base")(
        vectorstore=vectorstore, search_type="similarity", k=16
    )

    if retriever_name == "base":
        return {"retriever": base, "base_retriever": base, "compressor": None}

    factory = get_retriever_factory(retriever_name)
    if retriever_name == "cohere_rerank":
        retriever = factory(
            base_retriever=base, cohere_api_key=api_keys.get("cohere", "")
        )
    else:
        retriever = factory(embeddings=embeddings, base_retriever=base)

    return {
        "retriever": retriever,
        "base_retriever": base,
        "compressor": getattr(retriever, "base_compressor", None),
    }


def rerank_documents(compressor, documents, query: str):
    """Run the compressor stage over retrieved documents.

    Returns the list of (re)ranked/compressed documents.
    """
    if compressor is None:
        return documents
    return compressor.compress_documents(documents, query)