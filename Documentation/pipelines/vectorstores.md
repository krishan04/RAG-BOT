# Pipeline: Vectorstores — `GET/POST /api/vectorstores`

> Listing and creating knowledge bases (stores).

## GET `/api/vectorstores` — list

### Frontend
```text
StoresRail.tsx (chat page)  and  StoresView.tsx (/stores page)
 └── getVectorStores()
       │  fetch('/api/vectorstores') → Vite proxy → :8000
```

### Backend handler
```text
backend/fastapi_app/routers/vectorstores.py :: list_vectorstores()
 ├── django records:
 │    VectorStore.objects.annotate(document_count=Count("documents"))
 │      .values(id, name, embedding_provider, persist_path,
 │              chunk_size, chunk_overlap, created_at, document_count)
 ├── persisted dirs:
 │    for each dir in settings.VECTOR_STORE_ROOT
 │      if dir contains chroma.sqlite3 → include its name
 └── engine_variants:
      rag.vectorstores.list_vectorstores() → ["chroma"]
```

### Response
```json
{
  "django": [ { "id": 1, "name": "CV", "embedding_provider": "google",
                 "persist_path": "/…/data/vector_stores/CV",
                 "chunk_size": 1600, "chunk_overlap": 200,
                 "created_at": "…", "document_count": 3 } ],
  "persisted": ["CV", "Vit_All_HF_Embeddings"],
  "engine_variants": ["chroma"]
}
```

### Notes (verified)
- `django` = ORM records; `persisted` = on-disk Chroma dirs; the two can disagree
  (e.g. deleted dir with a leftover record).
- `engine_variants` is not rendered by the current UI.

## POST `/api/vectorstores` — create

### Frontend
`api/client.ts::createVectorStore` exists but is **not called by any UI component**
(verified). Stores are usually created implicitly through `POST /api/documents`.

### Backend handler
```text
vectorstores.py :: create_vectorstore(payload: VectorStoreCreate)
 └── VectorStore.objects.get_or_create(name=payload.name,
        defaults={ embedding_provider: payload.embedding_provider.value,
                   persist_path: str(settings.VECTOR_STORE_ROOT / payload.name) })
```

### Response
```json
{ "id": 3, "name": "my-base", "created": true }
```

Duplicate name → `{"created": false}` (not an error).

## Errors

- Pydantic 422 for bad `embedding_provider` enum or invalid `name` length.

## Key files

| Role | File |
| ---- | ---- |
| UI lists | `frontend/src/components/workspace/StoresRail.tsx`, `frontend/src/components/StoresView.tsx` |
| API client | `frontend/src/api/client.ts` |
| Router | `backend/fastapi_app/routers/vectorstores.py` |
| Model | `backend/core/models.py` (`VectorStore`) |
| Chroma root config | `backend/config/settings.py` (`VECTOR_STORE_ROOT`) |