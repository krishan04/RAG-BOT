"""Text splitters component. Registry: ``get_splitter(name)`` / ``list_splitters()``.

Each module defines a factory returning a LangChain text splitter.
"""

from rag.splitters import character, recursive

_REGISTRY = {
    "recursive": recursive.create_recursive_splitter,
    "character": character.create_character_splitter,
}


def get_splitter(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown splitter '{name}'. Available: {list_splitters()}")
    return factory


def list_splitters() -> list[str]:
    return list(_REGISTRY.keys())