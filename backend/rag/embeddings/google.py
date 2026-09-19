"""Google Generative AI embeddings.

Lifted from ``RAG_app.py::select_embeddings_model``.
"""


def create_google_embeddings(api_key: str = ""):
    """Return a ``GoogleGenerativeAIEmbeddings`` instance and validate it."""
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001", google_api_key=api_key
    )
    # Validate availability with a probe embed (raises on failure).
    embeddings.embed_query("validation test")
    return embeddings