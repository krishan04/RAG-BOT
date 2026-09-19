"""Cohere reranker retriever.

Lifted from ``RAG_app.py::CohereRerank_retriever``.
"""


def create_cohere_rerank_retriever(
    base_retriever,
    cohere_api_key: str = "",
    cohere_model: str = "rerank-multilingual-v3.0",
    top_n: int = 10,
):
    """Build a ``ContextualCompressionRetriever`` using CohereRerank to reorder results."""
    from langchain.retrievers import ContextualCompressionRetriever
    from langchain.retrievers.document_compressors import CohereRerank

    compressor = CohereRerank(
        cohere_api_key=cohere_api_key, model=cohere_model, top_n=top_n
    )
    return ContextualCompressionRetriever(
        base_compressor=compressor, base_retriever=base_retriever
    )