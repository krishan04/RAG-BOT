"""HuggingFace Inference API embeddings.

Lifted from ``RAG_app.py::select_embeddings_model``.
"""


def create_hf_embeddings(api_key: str = ""):
    """Return a ``HuggingFaceInferenceAPIEmbeddings`` instance."""
    from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings

    return HuggingFaceInferenceAPIEmbeddings(
        api_key=api_key, model_name="thenlper/gte-large"
    )