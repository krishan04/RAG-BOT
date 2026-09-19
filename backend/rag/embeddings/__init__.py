"""Embeddings component. Registry: ``get_embeddings_factory(name)``.

Each module defines a factory that builds an embeddings model from an API key.
"""

from rag.embeddings import google, huggingface, openai

_REGISTRY = {
    "openai": openai.create_openai_embeddings,
    "google": google.create_google_embeddings,
    "huggingface": huggingface.create_hf_embeddings,
}


def get_embeddings_factory(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown embeddings '{name}'. Available: {list_embeddings()}")
    return factory


def list_embeddings() -> list[str]:
    return list(_REGISTRY.keys())