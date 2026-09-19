"""OpenAI embeddings. Lifted from ``RAG_app.py::select_embeddings_model``."""


def create_openai_embeddings(api_key: str = ""):
    """Return an ``OpenAIEmbeddings`` instance."""
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(api_key=api_key)