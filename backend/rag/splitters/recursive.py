"""Recursive character text splitter (ingestion).

Lifted from ``RAG_app.py::split_documents_to_chunks``.
"""


def create_recursive_splitter(chunk_size: int = 1600, chunk_overlap: int = 200):
    """Return a ``RecursiveCharacterTextSplitter`` splitter factory."""
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    return RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)