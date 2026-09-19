"""Pydantic request/response models for the RAG API."""

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    api: str = "fastapi"
    django: str
    version: str


class EmbeddingName(str, Enum):
    OPENAI = "openai"
    GOOGLE = "google"
    HUGGINGFACE = "huggingface"


class RetrieverName(str, Enum):
    BASE = "base"
    CONTEXTUAL_COMPRESSION = "contextual_compression"
    COHERE_RERANK = "cohere_rerank"


class VectorStoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    embedding_provider: EmbeddingName = EmbeddingName.OPENAI


class DocumentIngestResponse(BaseModel):
    vector_store: str
    chunk_count: int
    config: dict[str, Any]


class ChatRequest(BaseModel):
    vector_store: str
    question: str
    llm_provider: Literal["openai", "google", "huggingface"] = "google"
    model: str = ""
    language: str = "english"
    retriever: RetrieverName = RetrieverName.BASE
    memory: Literal["buffer", "summary"] = "buffer"
    temperature: float = 0.5
    top_p: float = 0.95


class ChatResponse(BaseModel):
    answer: str
    source_documents: list[dict[str, Any]] = []
    query_ms: float = 0.0
    retrieval_ms: float = 0.0
    rerank_ms: float = 0.0
    ttft_ms: float | None = None
    token_estimate: int = 0
    trace: dict[str, Any] = {}


class BenchmarkRunCreate(BaseModel):
    name: str = ""
    config_matrix: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Component-variant matrix, e.g. {'embeddings': ['openai', 'google']}",
    )


class BenchmarkRunResponse(BaseModel):
    id: int
    name: str
    status: str
    config_json: dict[str, Any]