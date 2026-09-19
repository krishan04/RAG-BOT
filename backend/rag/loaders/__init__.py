"""Document loaders component. Registry: ``get_loader(name)`` / ``list_loaders()``.

Each module defines a factory returning a LangChain document loader for a
single document type. Drop a new file here and register it to benchmark a new
loader variant.
"""

from rag.loaders import directory_loader

_REGISTRY = {
    "directory": directory_loader.create_directory_loader,
}


def get_loader(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown loader '{name}'. Available: {list_loaders()}")
    return factory


def list_loaders() -> list[str]:
    return list(_REGISTRY.keys())