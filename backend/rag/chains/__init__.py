"""Chains component. Registry: ``get_chain(name)`` / ``list_chains()``.

Each module defines a factory that builds a LangChain chain from a retriever,
LLMs and memory.
"""

from rag.chains import conversational

_REGISTRY = {
    "conversational": conversational.create_conversational_chain,
}


def get_chain(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown chain '{name}'. Available: {list_chains()}")
    return factory


def list_chains() -> list[str]:
    return list(_REGISTRY.keys())