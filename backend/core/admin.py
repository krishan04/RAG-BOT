from django.contrib import admin

from .models import BenchmarkRun, ChatSession, Document, Message, VectorStore


@admin.register(VectorStore)
class VectorStoreAdmin(admin.ModelAdmin):
    list_display = ("name", "embedding_provider", "created_at")
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("filename", "vector_store", "status", "chunk_count", "created_at")
    list_filter = ("status", "file_type")
    search_fields = ("filename",)


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "vector_store", "llm_provider", "model", "created_at")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "created_at")
    list_filter = ("role",)


@admin.register(BenchmarkRun)
class BenchmarkRunAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at", "finished_at")
    list_filter = ("status",)