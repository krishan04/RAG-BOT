# 08 — Data Flow

> How the four main entities move through the system, from UI state to database and back.
> Every arrow below is a verified file → file relationship.

---

## 1. Entity inventory (verified from `core/models.py` + `frontend/src/models.ts`)

| Backend model | DB table | Frontend type | Where it lives |
| ------------- | -------- | ------------- | -------------- |
| `VectorStore` | `core_vectorstore` | `VectorStore` | DB + `data/vector_stores/*` on disk |
| `Document` | `core_document` | — | DB (metadata for uploaded files) |
| `ChatSession` | `core_chatsession` | — | DB |
| `Message` | `core_message` | `ChatMessage` | DB (user/assistant/system turns + `trace_json` + `sources_json`) |
| `BenchmarkRun` | `core_benchmarkrun` | `BenchmarkRun` | DB + `backend/storage/tmp/bench_run_*` scratch Chroma |

---

## 2. VectorStore flow

```text
User names a store ("my-base")
 ↓
UI (ChatCanvas / IngestionModal)
 └── uploadDocuments({vectorStore:"my-base", ...})  or  getVectorStores()
      ↓
POST /api/documents?vector_store=my-base              GET /api/vectorstores
 ↓                                                    ↓
ingestion.py::ingest_documents                         vectorstores.py::list_vectorstores
 ↓                                                    ↓
VectorStore.objects.get_or_create(name="my-base")      VectorStore.objects.annotate(document_count=…)
 ↓                                                    ↓
persist_path = data/vector_stores/my-base              reads on-disk dirs (Chroma sqlite3)
 ↓                                                    ↓
Chroma.from_documents(...) → persist to disk           returns {django:[…], persisted:[…], engine_variants}
 ↓                                                    ↓
DB row (core_vectorstore) updated                      StoresRail / StoresView render store list
 ↓
Document rows created
```

### UI state shape
```typescript
// StoresRail.tsx / StoresView.tsx
VectorStoresResponse = { django: VectorStore[], persisted: string[], engine_variants: string[] }
// ChatWorkspace.tsx
selectedStore: VectorStore | null   // user picks one
```

---

## 3. Document flow

```text
User uploads file(s)
 ↓
IngestionModal: files (FileList) + store name + provider + chunk config
 ↓
uploadDocuments() → POST /api/documents (multipart)
 ↓
ingestion.py: write to TMP_DIR → hash via sha1
 ↓
rag.services.ingestion.ingest_documents()
 ├── DirectoryLoader (txt/pdf/csv/docx) → list[Document] (LangChain doc type)
 ├── RecursiveCharacterTextSplitter(1600, 200) → chunks
 ├── Google/OpenAI/HF embeddings → embeddings per chunk
 └── Chroma.from_documents → persisted under data/vector_stores/<name>/
 ↓
core Document row: filename, file_type, upload_hash, chunk_count, status=INGESTED
 ↓
IngestionModal.onComplete(storeName)
 ↓
StoresRail refetch (refreshKey++)
 ↓
UI shows updated doc_count for that store
```

---

## 4. ChatMessage + ExecutionTrace flow (the most complex)

```text
User types message in ChatCanvas
 ↓
handleSend: append local ChatMessage {sender: 'user', text: question, timestamp}
 ↓
sendChat({vector_store, question, llm_provider, model, retriever, memory})
 ↓
POST /api/chat → chat.py::chat()
 ↓
1. Load Chroma vectorstore
2. build_retriever → retriever + compressor
3. _build_llms → (condense_llm, response_llm)
4. get_memory → memory object
5. ChatSession.objects.create(...)     ← session metadata
6. Message.objects.create(role=user)   ← persists user turn
7. execute_pipeline(vectorstore, compressor, ...)
   ├── condense question via LLMChain        → condensed_question
   ├── similarity_search_with_score(k=16)    → docs[], scores[], score_map
   ├── rerank_documents(compressor, docs)    → final_docs
   └── response_llm.stream(...) + TTFT       → answer string
8. build sources[] array: [{source, page, content, score, chunk_hash, tokens, retrieval_ms}]
9. build trace dict: {condense_ms, query_ms, retrieval_ms, rerank_ms, generation_ms,
   ttft_ms, token_estimate, k_retrieved, k_filtered, score_bounds, condensed_question,
   chunk_size, chunk_overlap, language, file_types, retriever, sources}
10. memory.save_context({question}, {answer})
11. Message.objects.create(role=assistant, content=answer,
    sources_json=sources, trace_json=trace)    ← persists assistant turn + trace
12. return ChatResponse(answer, source_documents, query_ms, retrieval_ms, rerank_ms,
    ttft_ms, token_estimate, trace)
 ↓
UI: ChatCanvas appends assistant ChatMessage with trace: res.trace
    ├── setTrace(res.trace) → TraceContext → PipelineTrace renders 4-stage panel
    ├── MessageBubble renders answer (react-markdown)
    └── SourceBadge row → clicking focuses trace panel on that chunk
```

### TraceContext state

```typescript
// TraceContext.tsx
trace: ExecutionTrace | null        // latest assistant trace
focusSource: RetrievalSource | null // user clicked a source chip
focusTrace: ExecutionTrace | null   // trace of that source (may differ if switching messages)
focus(source, traceOverride?)       // set both; PipelineTrace uses focusTrace || trace
```

### Key insight
ChatSession and Message are written **after** the pipeline runs successfully, so a
failed pipeline does not create orphaned session/message rows. This is a deliberate
design in `chat.py:62-71`.

---

## 5. BenchmarkRun flow

```text
User selects variant matrix in BenchmarksLab
 ↓
runBenchmark({config_matrix: {embeddings: [...], retrievers: [...]}})
 ↓
POST /api/benchmarks → create_benchmark()
 ↓
build_matrix(config_matrix) → cartesian list of variant dicts
 ↓
BenchmarkRun.objects.create(config_json={config_matrix, runs})
 ↓  (status = PENDING → RUNNING)
run_benchmark(run):
  per variant:
    ├── ingest_documents → scratch Chroma under TMP_DIR/bench_run_{pk}_{i}/
    ├── build_chat_engine → chain + memory
    ├── chain.invoke(BENCHMARK_QUESTIONS[0])
    └── append results dict to results_json (incremental save)
 ↓
status = COMPLETED (or FAILED)
 ↓
BenchmarkRunResponse → BenchmarksLab renders results table
```

### BenchmarkRun results shape (inside `results_json.results[]`)
```json
{
  "label": "openai x base",
  "embeddings": "openai",
  "retrievers": "base",
  "chunk_count": 5,
  "ingestion_ms": 1200.0,
  "query_ms": 3400.5,
  "source_count": 2,
  "answer_sample": "This project is a RAG chatbot…",
  "status": "ok"
}
```

---

## 6. Cross-cutting data flow notes

- **All persistence goes through Django ORM**; there is no raw SQL anywhere.
- **Chroma data is written by LangChain**, not by Django; Django only stores the
  metadata pointer (`VectorStore.persist_path`).
- **`trace_json` on Message is the link** between the API response's trace dict and what
  the frontend `PipelineTrace` panel renders; both the DB and the UI read/write the same
  shape (`ExecutionTrace`).
- **Fresh buffer memory:** `ChatSession` is created with `memory.load_memory_variables({})`
  which returns `[]` (no prior history), so `execute_pipeline` sees an empty chat_history
  and the condense stage is skipped. The in-memory `ConversationBufferMemory` is
  populated *after* the answer, but **not carried across requests** — each chat API
  request is stateless. Cross-request memory persistence does not exist (verified).