"""Chroma vectorstore support.

Lifted from ``RAG_app.py::chain_RAG_blocks`` (create) and the "Open a saved
Vectorstore" tab (load).
"""


def create_chroma_vectorstore(embedding, persist_directory: str = ""):
    """Return a function to create a Chroma store from documents.

    The returned callable accepts ``documents`` and returns the Chroma store.
    """
    from langchain_community.vectorstores import Chroma

    def create(documents):
        return Chroma.from_documents(
            documents=documents,
            embedding=embedding,
            persist_directory=persist_directory,
        )

    return create


def load_chroma_vectorstore(embedding, persist_directory: str = ""):
    """Load an existing Chroma store from ``persist_directory``."""
    from langchain_community.vectorstores import Chroma

    return Chroma(
        embedding_function=embedding,
        persist_directory=persist_directory,
    )