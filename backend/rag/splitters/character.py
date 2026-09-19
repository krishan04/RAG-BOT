"""Character text splitter (used by the compression retriever).

Lifted from ``RAG_app.py::create_compression_retriever``.
"""


def create_character_splitter(chunk_size: int = 500, chunk_overlap: int = 0, separator: str = ". "):
    """Return a ``CharacterTextSplitter`` splitter factory."""
    from langchain.text_splitter import CharacterTextSplitter

    return CharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, separator=separator
    )