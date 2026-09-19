"""Vectorstores component. Registry: ``get_vectorstore_factory(name)``.

Each module defines a factory managing a vectorstore (create / load).
"""

from rag.vectorstores import chroma

_REGISTRY = {
    "chroma": chroma.create_chroma_vectorstore,
}


def get_vectorstore_factory(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown vectorstore '{name}'. Available: {list_vectorstores()}")
    return factory


def list_vectorstores() -> list[str]:
    return list(_REGISTRY.keys())