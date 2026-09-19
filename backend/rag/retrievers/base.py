"""Vectorstore-backed base retriever.

Lifted from ``RAG_app.py::Vectorstore_backed_retriever``.
"""


def create_base_retriever(
    vectorstore,
    search_type: str = "similarity",
    k: int = 16,
    score_threshold=None,
):
    """Create a vectorstore-backed retriever.

    Parameters:
        search_type: "similarity", "mmr" or "similarity_score_threshold".
        k: number of documents to return.
        score_threshold: minimum relevance threshold (for scored search types).
    """
    search_kwargs = {}
    if k is not None:
        search_kwargs["k"] = k
    if score_threshold is not None:
        search_kwargs["score_threshold"] = score_threshold

    return vectorstore.as_retriever(
        search_type=search_type, search_kwargs=search_kwargs
    )