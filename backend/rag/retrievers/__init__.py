"""Retrievers component. Registry: ``get_retriever_factory(name)``.

Each module defines a factory that builds a retriever from an existing
vectorstore + embeddings.
"""

from rag.retrievers import (
    base,
    cohere_rerank,
    contextual_compression,
)

_REGISTRY = {
    "base": base.create_base_retriever,
    "contextual_compression": contextual_compression.create_compression_retriever,
    "cohere_rerank": cohere_rerank.create_cohere_rerank_retriever,
}


def get_retriever_factory(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown retriever '{name}'. Available: {list_retrievers()}")
    return factory


def list_retrievers() -> list[str]:
    return list(_REGISTRY.keys())