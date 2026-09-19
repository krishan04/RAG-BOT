"""Directory-based document loader for txt / pdf / csv / docx files.

Lifted from ``RAG_app.py::langchain_document_loader``.
"""


def create_directory_loader(tmp_dir=""):
    """Load all documents (txt/pdf/csv/docx) under ``tmp_dir``.

    Returns a callable that, when invoked, returns a list of LangChain
    ``Document`` objects.
    """
    from langchain_community.document_loaders import (
        CSVLoader,
        DirectoryLoader,
        Docx2txtLoader,
        PyPDFLoader,
        TextLoader,
    )

    loaders = [
        DirectoryLoader(tmp_dir, glob="**/*.txt", loader_cls=TextLoader, show_progress=True),
        DirectoryLoader(tmp_dir, glob="**/*.pdf", loader_cls=PyPDFLoader, show_progress=True),
        DirectoryLoader(
            tmp_dir,
            glob="**/*.csv",
            loader_cls=CSVLoader,
            loader_kwargs={"encoding": "utf8"},
            show_progress=True,
        ),
        DirectoryLoader(
            tmp_dir, glob="**/*.docx", loader_cls=Docx2txtLoader, show_progress=True
        ),
    ]

    def load():
        documents = []
        for loader in loaders:
            documents.extend(loader.load())
        return documents

    return load