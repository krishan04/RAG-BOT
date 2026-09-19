# Pipeline: Document Ingestion — `POST /api/documents`

> Upload → load → split → embed → persist.

## Frontend

```text
IngestionModal.tsx (open from StoresRail / StoresView "New Knowledge Base" / ChatCanvas drop)
 └── submit handler
      ├── parses store name, provider, chunk size/overlap, files (FileList)
      └── uploadDocuments({vectorStore, provider, files, chunkSize=1600, chunkOverlap=200})
            │
frontend/src/api/client.ts: uploadDocuments()
            │  new FormData() + 'files' entries
            │  fetch(`/api/documents?vector_store=…&embedding_provider=…&chunk_size=…&chunk_overlap=…`,
            │        {POST, body: formData})  → Vite proxy → :8000
            ▼
```

## Wire protocol

```http
POST /api/documents?vector_store=CV&embedding_provider=google&splitter=recursive&chunk_size=1600&chunk_overlap=200
Content-Type: multipart/form-data
files=@intro.txt (one or more)
```

## Backend handler

```text
backend/fastapi_app/routers/ingestion.py :: ingest_documents(vector_store, files, ...)
 1. 422 if not files
 2. VectorStore.objects.get_or_create(name=vector_store,
       defaults={embedding_provider, chunk_size, chunk_overlap})
    store.embedding_provider / chunk_size / chunk_overlap / persist_path overwritten
    store.persist_path = settings.VECTOR_STORE_ROOT / vector_store ; store.save()
 3. wipe settings.TMP_DIR (glob + unlink)
 4. write each upload to TMP_DIR; file_hashes[filename] = sha1(content).hexdigest()
 5. run_ingestion = rag.services.ingestion.ingest_documents(
      tmp_dir, splitter_name, embeddings_name, persist_directory, api_keys,
      chunk_size, chunk_overlap)
 6. except → if created: store.delete(); raise 500 "Ingestion failed: {exc}"
    finally → wipe TMP_DIR again
 7. per file: Document.objects.update_or_create(vector_store=store, filename=…,
      defaults={file_type, upload_hash, chunk_count, status=INGESTED})
 8. return DocumentIngestResponse(vector_store, chunk_count, config)
```

## The service pipeline

```text
backend/rag/services/ingestion.py

ingest_documents(documents=None, tmp_dir, splitter_name="recursive",
                 embeddings_name="openai", vectorstore_name="chroma",
                 persist_directory, api_keys, chunk_size=1600, chunk_overlap=200)
 ↓
documents = load_documents(tmp_dir)
 ↓  rag.loaders.get_loader("directory")(tmp_dir).load()
    → rag/loaders/directory_loader.py: 4× DirectoryLoader
        **/*.txt → TextLoader
        **/*.pdf → PyPDFLoader
        **/*.csv → CSVLoader (utf8)
        **/*.docx → Docx2txtLoader
 ↓
splitter = rag.splitters.get_splitter("recursive")(chunk_size, chunk_overlap)
    → rag/splitters/recursive.py RecursiveCharacterTextSplitter
 ↓
embeddings = rag.embeddings.get_embeddings_factory("google")(api_key)
    → rag/embeddings/google.py GoogleGenerativeAIEmbeddings(embed-001) + live probe
 ↓
chunks = splitter.split_documents(documents)
 ↓
create = rag.vectorstores.get_vectorstore_factory("chroma")(embeddings, persist_directory)
vectorstore = create(chunks)  → Chroma.from_documents(...)  → persisted to data/vector_stores/<name>/
 ↓
return {vectorstore, chunk_count: len(chunks), config:{splitter, embeddings, vectorstore, chunk_size, chunk_overlap}}
```

## External calls made

| Call | Provider | Built by |
| ---- | -------- | -------- |
| Document parsing (pdf/csv/docx/txt) | local | `rag/loaders/directory_loader.py` |
| Embedding generation per chunk | OpenAI / Gemini / HuggingFace | `rag/embeddings/<provider>.py` |
| Vector indexing + persistence | local Chroma | `rag/vectorstores/chroma.py` |

Note: Google embeddings run a **live validation probe** (`embed_query("validation test")`)
at construction, so an unset/failing `GEMINI_API` makes ingestion fail here with 500.

## Persistence

```text
Disk:   data/vector_stores/<name>/chroma.sqlite3 + HNSW bins
SQLite: core_vectorstore (row, upserted)
        core_document   (row per uploaded file, upserted)
```

## Response

```json
{
  "vector_store": "CV",
  "chunk_count": 42,
  "config": {
    "splitter": "recursive", "embeddings": "google", "vectorstore": "chroma",
    "chunk_size": 1600, "chunk_overlap": 200,
    "document_count": 1, "status": "ingested"
  }
}
```

## Errors

- `422` `{"detail": "No files provided."}`
- `500` `{"detail": "Ingestion failed: <exc>"}` — created store is rolled back.
- Provider failures (missing keys, network) surface inside that 500.

## Key files

| Role | File |
| ---- | ---- |
| UI / dialog | `frontend/src/components/IngestionModal.tsx` |
| API client | `frontend/src/api/client.ts` |
| Router | `backend/fastapi_app/routers/ingestion.py` |
| Service | `backend/rag/services/ingestion.py` |
| Loader | `backend/rag/loaders/directory_loader.py` |
| Splitter | `backend/rag/splitters/recursive.py` |
| Embeddings | `backend/rag/embeddings/*.py` |
| Vectorstore | `backend/rag/vectorstores/chroma.py` |
| Persistence | `backend/core/models.py` |