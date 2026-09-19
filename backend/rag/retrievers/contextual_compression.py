"""Contextual compression retriever (DocumentCompressorPipeline).

Lifted from ``RAG_app.py::create_compression_retriever``.
The pipeline splits docs into smaller chunks, removes redundant documents,
filters the top relevant ones and reorders (most relevant at ends).
"""

from rag.splitters.character import create_character_splitter


def create_compression_retriever(
    embeddings,
    base_retriever,
    k: int = 16,
    similarity_threshold=None,
    chunk_size: int = 500,
):
    """Build a ``ContextualCompressionRetriever`` wrapping a base retriever."""
    from langchain.retrievers import ContextualCompressionRetriever
    from langchain.retrievers.document_compressors import DocumentCompressorPipeline
    from langchain_community.document_transformers import (
        EmbeddingsRedundantFilter,
        LongContextReorder,
    )
    from langchain.retrievers.document_compressors import EmbeddingsFilter

    splitter = create_character_splitter(chunk_size=chunk_size)
    redundant_filter = EmbeddingsRedundantFilter(embeddings=embeddings)
    relevant_filter = EmbeddingsFilter(
        embeddings=embeddings, k=k, similarity_threshold=similarity_threshold
    )
    reordering = LongContextReorder()

    pipeline_compressor = DocumentCompressorPipeline(
        transformers=[splitter, redundant_filter, relevant_filter, reordering]
    )
    return ContextualCompressionRetriever(
        base_compressor=pipeline_compressor, base_retriever=base_retriever
    )