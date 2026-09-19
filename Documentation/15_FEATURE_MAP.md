# 15 — Feature Map

> For every major feature, the complete file-path chain from UI → API → backend → DB
> (or external service). Use this to answer: "Where is this feature implemented?"

---

## 1. Health check

```text
UI:  frontend/src/components/layout/NavRail.tsx → useEffect → client.getHealth()
API: GET /api/health
Router: backend/fastapi_app/routers/health.py :: health()
Schema: backend/fastapi_app/schemas.py :: HealthResponse
External: none
DB: none
Response: {status, api, django, version}
```

---

## 2. List vectorstores

```text
UI:  StoresRail.tsx + StoresView.tsx → getVectorStores()
API: GET /api/vectorstores
Router: backend/fastapi_app/routers/vectorstores.py :: list_vectorstores()
Backend: core/models.py VectorStore.annotate(Count("documents")).values(...),
         rag/vectorstores/__init__.py list_vectorstores(),
         dir scan settings.VECTOR_STORE_ROOT
DB: reads core_vectorstore
Disk: reads data/vector_stores/*/chroma.sqlite3
Response: {django:[], persisted:[], engine_variants:[]}
```

---

## 3. Create vectorstore (implicit — no UI path)

```text
UI:  (no caller — client.createVectorStore exists but is unused — verified quirk)
API: POST /api/vectorstores
Router: vectorstores.py :: create_vectorstore(VectorStoreCreate)
Backend: core/models.py VectorStore.objects.get_or_create(...)
DB: writes core_vectorstore
```

---

## 4. Document ingestion

```text
UI:  IngestionModal.tsx → uploadDocuments({vectorStore, provider, files, chunkSize, chunkOverlap})
API: POST /api/documents?vector_store=...&embedding_provider=...&chunk_size=...&chunk_overlap=...
Router: backend/fastapi_app/routers/ingestion.py :: ingest_documents(vector_store, files, ...)
Backend:
  core/models.py VectorStore.get_or_create(...), .save()
  rag/services/ingestion.py :: ingest_documents(...)
    ├── rag/loaders/directory_loader.py (txt/pdf/csv/docx)
    ├── rag/splitters/recursive.py (RecursiveCharacterTextSplitter 1600/200)
    ├── rag/embeddings/*.py (provider-dependent)
    └── rag/vectorstores/chroma.py (Chroma.from_documents)
DB: writes core_vectorstore, core_document
Disk: data/vector_stores/<name>/chroma.sqlite3
Response: DocumentIngestResponse(vector_store, chunk_count, config)
```

---

## 5. Chat with RAG

```text
UI:  ChatCanvas.tsx :: handleSend() → sendChat({...})
API: POST /api/chat
Router: backend/fastapi_app/routers/chat.py :: chat(ChatRequest)
Backend:
  core/models.py ChatSession.create(), Message.create() ×2
  rag/embeddings/__init__.py get_embeddings_factory(provider)
  rag/vectorstores/chroma.py load_chroma_vectorstore(...)
  rag/services/retrieval.py build_retriever(...)
    ├── rag/retrievers/base.py  |  contextual_compression.py  |  cohere_rerank.py
  rag/services/chatbot.py _build_llms(...)
    ├── langchain_openai / langchain_google_genai / langchain_community
  rag/memory/__init__.py get_memory("buffer"|"summary")
  rag/services/execution.py :: execute_pipeline(...)
    ├── Stage 1: LLMChain (condense prompt)
    ├── Stage 2: Chroma.similarity_search_with_score(k=16)
    ├── Stage 3: rag/services/retrieval.rerank_documents(compressor, docs)
    └── Stage 4: response_llm.stream + FirstTokenCallbackHandler (TTFT)
  rag/prompts/__init__.py get_prompt("answer")(language), get_prompt("condense")()
DB: writes core_chatsession, core_message (2 rows, trace_json + sources_json)
Response: ChatResponse(answer, source_documents, trace, timing fields)
UI update:
  ChatCanvas → setState messages → MessageBubble (react-markdown) + SourceBadge row
  TraceContext.setTrace → PipelineTrace 4-stage panel
  SourceBadge.click → TraceContext.focus → spotlight chunk in trace
```

---

## 6. Pipeline trace / MLOps cockpit

```text
UI:  TraceContext.tsx (global context), PipelineTrace.tsx (4-stage panel)
Data source: ChatResponse.trace dict (set via setTrace in ChatCanvas after sendChat)
Trace structure (from execution.py → chat.py → Message.trace_json):
  {condense_ms, retrieval_ms, rerank_ms, generation_ms, ttft_ms,
   k_retrieved, k_filtered, score_bounds, condensed_question,
   chunk_size, chunk_overlap, language, file_types, retriever, sources}
  + focusSource/focusTrace: TraceContext holds focused chunk for spotlighting
```

---

## 7. Benchmark (run + inspect)

```text
UI:  BenchmarksLab.tsx → runBenchmark({config_matrix}) + listBenchmarks()
API: POST /api/benchmarks  (run), GET /api/benchmarks (list), GET /api/benchmarks/{id} (single)
Router: backend/fastapi_app/routers/benchmarks.py
Backend:
  rag/benchmarks/runner.py :: build_matrix(config_matrix), run_benchmark(run)
    ├── rag/services/ingestion.py::ingest_documents (per variant, timed)
    ├── rag/embeddings/__init__.py get_embeddings_factory
    ├── rag/services/retrieval.py build_retriever
    ├── rag/services/chatbot.py build_chat_engine
    │     └── _build_llms, get_chain("conversational"), get_memory("buffer"), get_prompt
    └── chain.invoke(BENCHMARK_QUESTIONS[0]) per variant, timed
  rag/benchmarks/metrics.py :: Metrics (latency context manager)
DB: writes core_benchmarkrun (config_json, results_json, status, timestamps)
Response: BenchmarkRunResponse → BenchmarksLab renders results table
```

---

## 8. Django admin

```text
UI:  http://127.0.0.1:8000/admin  (Django template, not React)
Router: backend/config/urls.py :: path('admin/', admin.site.urls)
Admin: backend/core/admin.py — VectorStoreAdmin, DocumentAdmin, ChatSessionAdmin,
       MessageAdmin, BenchmarkRunAdmin
Auth: Django session auth (login page)
```

---

## 9. Retriever variant selection

```text
UI:  PipelineSettingsPopover.tsx → ChatCanvas.pipeline.retriever (user picks one)
API: POST /api/chat → ChatRequest.retriever
Router: chat.py → payload.retriever.value → rag/services/retrieval.build_retriever(retriever_name=…)
Backend: rag/retrievers/__init__.py get_retriever_factory(name)
         ├── "base" → rag/retrievers/base.py
         ├── "contextual_compression" → rag/retrievers/contextual_compression.py
         │     └── imports rag/splitters/character.py (module-level cross edge)
         └── "cohere_rerank" → rag/retrievers/cohere_rerank.py (Cohere API)
Pipeline: execution.py rerank_documents(compressor, …) runs the explicit stage
```

---

## 10. Provider/model selection

```text
UI:  PipelineSettingsPopover.tsx → ChatCanvas.pipeline (provider + model text input)
API: POST /api/chat → ChatRequest.llm_provider, model, temperature, top_p
Router: chat.py → rag/services/chatbot._build_llms(provider, api_key, model, temperature, top_p)
Backend:
  "openai"     → langchain_openai.ChatOpenAI (model default: gpt-4-turbo-preview)
  "google"     → langchain_google_genai.ChatGoogleGenerativeAI (default: gemini-2.5-flash)
  "huggingface"→ langchain_community.llms.HuggingFaceHub (default: mistralai/Mistral-7B-Instruct-v0.2)
```

---

## 11. Embedding provider selection

```text
UI:  IngestionModal.tsx (embedding_provider dropdown)
API: POST /api/documents?embedding_provider=…
Router: ingestion.py → rag/services/ingestion.py → rag/embeddings/__init__.py get_embeddings_factory(name)
Backend:
  "openai"     → rag/embeddings/openai.py → OpenAIEmbeddings (text-embedding-ada-002)
  "google"     → rag/embeddings/google.py → GoogleGenerativeAIEmbeddings (gemini-embedding-001, live probe)
  "huggingface"→ rag/embeddings/huggingface.py → HuggingFaceInferenceAPIEmbeddings (thenlper/gte-large)
```

---

## 12. Component registry (meta-feature)

```text
Backend: backend/rag/registry.py COMPONENTS dict
  ├── prompts/__init__.py     get_prompt / list_prompts
  ├── loaders/__init__.py     get_loader / list_loaders
  ├── splitters/__init__.py   get_splitter / list_splitters
  ├── embeddings/__init__.py  get_embeddings_factory / list_embeddings
  ├── vectorstores/__init__.py get_vectorstore_factory / list_vectorstores
  ├── retrievers/__init__.py  get_retriever_factory / list_retrievers
  ├── memory/__init__.py      get_memory / list_memory_types
  └── chains/__init__.py      get_chain / list_chains
Used by: services/ingestion.py, services/chatbot.py, services/retrieval.py,
         fastapi_app/routers/chat.py, fastapi_app/routers/ingestion.py
To add a new variant: add a create_* file + register in the package __init__
```

---

## Quick "where to modify" lookup

| If I want to change… | Edit this |
| -------------------- | --------- |
| The chat prompt instructions | `backend/rag/prompts/answer.py` (answer_template) |
| Default chunk size/overlap | `backend/core/models.py` VectorStore defaults (0002 migration) |
| The default LLM provider/model | `backend/rag/services/chatbot.py` DEFAULT_MODELS; `backend/fastapi_app/schemas.py` ChatRequest defaults |
| How the trace panel looks | `frontend/src/components/telemetry/PipelineTrace.tsx` |
| What fields are in the trace | `backend/rag/services/execution.py` trace dict; `frontend/src/models.ts` ExecutionTrace |
| The retrieval score/filtering logic | `backend/rag/services/execution.py` Stage 2-3 |
| Add a new embeddings provider | `backend/rag/embeddings/new.py` + register in `rag/embeddings/__init__.py` |
| Add a new retriever | `backend/rag/retrievers/new.py` + register + ensure `base_compressor` is set |
| Change the frontend theme | `frontend/src/index.css` (@theme block) |