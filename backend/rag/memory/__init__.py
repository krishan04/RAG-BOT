"""Memory component. Registry: ``get_memory(name)`` / ``list_memory_types()``.

Each module defines a factory returning a LangChain conversation memory.
"""

from rag.memory import buffer, summary

_REGISTRY = {
    "buffer": buffer.create_buffer_memory,
    "summary": summary.create_summary_memory,
}


def get_memory(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown memory '{name}'. Available: {list_memory_types()}")
    return factory


def list_memory_types() -> list[str]:
    return list(_REGISTRY.keys())