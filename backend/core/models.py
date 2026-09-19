"""Core business models shared by the RAG monolith.

These records persist the metadata of the RAG pipeline: vectorstores,
documents, chat sessions, messages and benchmark runs.
"""

from django.conf import settings
from django.db import models


class VectorStore(models.Model):
    """A persisted vectorstore (e.g. a Chroma directory)."""

    class EmbeddingProvider(models.TextChoices):
        OPENAI = "openai", "OpenAI"
        GOOGLE = "google", "Google Generative AI"
        HUGGINGFACE = "huggingface", "HuggingFace"

    name = models.CharField(max_length=255, unique=True)
    persist_path = models.CharField(max_length=1024, blank=True)
    embedding_provider = models.CharField(
        max_length=32, choices=EmbeddingProvider.choices, default=EmbeddingProvider.OPENAI
    )
    chunk_size = models.PositiveIntegerField(default=1600)
    chunk_overlap = models.PositiveIntegerField(default=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Document(models.Model):
    """A document ingested into a vectorstore."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        INGESTED = "ingested", "Ingested"
        FAILED = "failed", "Failed"

    vector_store = models.ForeignKey(
        VectorStore, on_delete=models.CASCADE, related_name="documents"
    )
    filename = models.CharField(max_length=1024)
    file_type = models.CharField(max_length=16, blank=True)
    upload_hash = models.CharField(max_length=64, blank=True)
    chunk_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.vector_store.name})"


class ChatSession(models.Model):
    """A conversation tied to a vectorstore, an LLM config and a retriever type."""

    title = models.CharField(max_length=255, blank=True)
    language = models.CharField(max_length=32, default="english")
    vector_store = models.ForeignKey(
        VectorStore, on_delete=models.SET_NULL, null=True, related_name="sessions"
    )
    llm_provider = models.CharField(max_length=32, blank=True)
    model = models.CharField(max_length=255, blank=True)
    retriever_type = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or f"Session {self.pk}"


class Message(models.Model):
    """A single chat message inside a conversation."""

    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    sources_json = models.JSONField(default=list, blank=True)
    trace_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class BenchmarkRun(models.Model):
    """A persisted benchmark execution comparing component variants.

    The ``config_json`` records which component variants were used
    (e.g. {"embeddings": ["openai", "google"], "retrievers": ["base", "cohere_rerank"]}).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=255, blank=True)
    config_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    results_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name or f"BenchmarkRun {self.pk}"


# Ensure runtime directories referenced by the RAG engine exist.
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_STORE_ROOT.mkdir(parents=True, exist_ok=True)
settings.TMP_DIR.mkdir(parents=True, exist_ok=True)