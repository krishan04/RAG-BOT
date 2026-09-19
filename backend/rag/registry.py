"""Master component registry for the RAG engine.

Each component folder exposes its own registry (``get_loader``,
``get_embeddings``, ...). This module aggregates them so a complete pipeline
can be selected from a single config dict, e.g.::

    {
        "loader": "directory",
        "splitter": "recursive",
        "embeddings": "openai",
        "vectorstore": "chroma",
        "retriever": "cohere_rerank",
        "memory": "buffer",
        "chain": "conversational",
    }
"""

from rag.prompts import get_prompt, list_prompts
from rag.loaders import get_loader, list_loaders
from rag.splitters import get_splitter, list_splitters
from rag.embeddings import get_embeddings_factory, list_embeddings
from rag.vectorstores import get_vectorstore_factory, list_vectorstores
from rag.retrievers import get_retriever_factory, list_retrievers
from rag.memory import get_memory, list_memory_types
from rag.chains import get_chain, list_chains

COMPONENTS = {
    "prompts": list_prompts,
    "loaders": list_loaders,
    "splitters": list_splitters,
    "embeddings": list_embeddings,
    "vectorstores": list_vectorstores,
    "retrievers": list_retrievers,
    "memory": list_memory_types,
    "chains": list_chains,
}


def list_component_types() -> dict[str, list[str]]:
    """Return every registered variant per component type (benchmark matrix)."""
    return {name: fn() for name, fn in COMPONENTS.items()}