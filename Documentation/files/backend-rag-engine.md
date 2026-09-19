# files/backend-rag-engine.md — The pluggable RAG engine

> Covers every file under `backend/rag/`. This is the heart of the application.

## How to read this

Per-component packages (`loaders`, `splitters`, `embeddings`, `vectorstores`,
`retrievers`, `memory`, `prompts`, `chains`) each:
- define a `create_*` factory in a submodule,
- register it in an `_REGISTRY` dict in the package `__init__.py`,
- expose `get_<component>(name)` → factory and `list_<component>()` → variant names.

The `services/` layer orchestrates those factories. `benchmarks/` drives services with
per-variant timing.

---

## `backend/rag/__init__.py`, `apps.py`, `models.py`, `admin.py`, `views.py`, `tests.py`

### Purpose
- `__init__.py`: empty package marker.
- `apps.py`: `RagConfig(AppConfig)` with `name = "rag"`.
- `models.py`: placeholder (`# Create your models here.`) — **the `rag` app has no
  models**; all persistence lives in `core`.
- `admin.py`: placeholder.
- `views.py`: placeholder.
- `tests.py`: placeholder (`from django.test import TestCase`) — no tests.

### Modification guide
These exist because Django needs an app package. You will almost never modify them.
If you add DB-backed RAG concepts, that design question is open
(`UNKNOWN / NEEDS VERIFICATION` where those records belong).

---

## `backend/rag/registry.py` — IMPORTANT

### Purpose
Aggregates all eight component registries into one `COMPONENTS` dict and exposes
`list_component_types()`.

### Imports (verified)
```text
rag/registry.py
 ├── imports → rag.prompts         (get_prompt, list_prompts)
 ├── imports → rag.loaders         (get_loader, list_loaders)
 ├── imports → rag.splitters       (get_splitter, list_splitters)
 ├── imports → rag.embeddings      (get_embeddings_factory, list_embeddings)
 ├── imports → rag.vectorstores    (get_vectorstore_factory, list_vectorstores)
 ├── imports → rag.retrievers      (get_retriever_factory, list_retrievers)
 ├── imports → rag.memory          (get_memory, list_memory_types)
 └── imports → rag.chains          (get_chain, list_chains)
```

### Exports
`COMPONENTS` (dict of name → list function), `list_component_types() -> dict[str,
list[str]]`.

### Functions
| Function | Params | Return | Purpose |
| -------- | ------ | ------ | ------- |
| `list_component_types` | none | `{component: [variants...]}` | Full benchmark variant matrix per component type |

### Verified note
`list_component_types` is currently **not called anywhere** in the repo. It mirrors the
matrix idea used by `benchmarks/runner.py::build_matrix`.

### Beginner explanation
One registry to rule them all. When the project wants "the whole component topology",
this is it.

### Modification guide
Update when a new component package is added (import it + add to `COMPONENTS`).

---

## `rag/services/ingestion.py` — **CORE**

### Purpose
The ingestion pipeline: (optionally load) → split → embed → persist.

### Imports
No module-level internal imports — all deferred into functions.

### Functions

#### `load_documents(tmp_dir: str = "")` → `list[Document]`
- Calls `get_loader("directory")(tmp_dir=tmp_dir)` then invokes the returned `.load()`.
- **Calls:** `rag.loaders.get_loader`.
- **Called by:** `ingest_documents`.

#### `ingest_documents(documents=None, tmp_dir="", splitter_name="recursive",
embeddings_name="openai", vectorstore_name="chroma", persist_directory="",
api_keys=None, chunk_size=1600, chunk_overlap=200)` → `dict`
- Steps (verified):
  1. `if documents is None: documents = load_documents(tmp_dir)`
  2. `splitter = get_splitter(splitter_name)(chunk_size, chunk_overlap)`
  3. `embeddings = get_embeddings_factory(embeddings_name)(api_key=api_keys.get(embeddings_name, ""))`
  4. `chunks = splitter.split_documents(documents)`
  5. `create = get_vectorstore_factory(vectorstore_name)(embeddings, persist_directory)`
  6. `vectorstore = create(chunks)`
  7. return `{"vectorstore", "chunk_count": len(chunks), "config": {splitter,
     embeddings, vectorstore, chunk_size, chunk_overlap}}`
- **Calls:** `load_documents`, `rag.splitters.get_splitter`, `rag.embeddings.get_embeddings_factory`, `rag.vectorstores.get_vectorstore_factory`, LangChain `split_documents`.
- **Called by:** `fastapi_app/routers/ingestion.py` (as `run_ingestion`),
  `rag/benchmarks/runner.py::run_benchmark`.
- **Side effects:** writes a Chroma store at `persist_directory`.

### Beginner explanation
"Give me these documents in this vectorstore." This is what `POST /api/documents` and
each benchmark ingestion stage invoke.

### Modification guide
Add a new vectorstore, change chunking defaults, or log per-stage timings.

---

## `rag/services/retrieval.py` — **CORE**

### Purpose
Retriever construction + the explicit rerank/compress stage used by `execute_pipeline`.

### Functions (verified)

#### `build_retriever(vectorstore, embeddings=None, retriever_name="base", api_keys=None)` → `{"retriever", "base_retriever", "compressor"}`
1. `base = get_retriever_factory("base")(vectorstore=vectorstore,
   search_type="similarity", k=16)`.
2. If `retriever_name == "base"`: return base for all three keys, `compressor=None`.
3. `factory = get_retriever_factory(retriever_name)`.
4. `cohere_rerank` → `factory(base_retriever=base, cohere_api_key=api_keys.get("cohere", ""))`.
5. else (`contextual_compression`) → `factory(embeddings=embeddings, base_retriever=base)`.
6. `compressor = getattr(retriever, "base_compressor", None)`.

#### `rerank_documents(compressor, documents, query: str)`
- If `compressor is None`, returns `documents` unchanged.
- Else `compressor.compress_documents(documents, query)`.

### Callers
- `build_retriever` ← `fastapi_app/routers/chat.py::chat`, `rag/benchmarks/runner.py`.
- `rerank_documents` ← `rag/services/execution.py::execute_pipeline`.

### Beginner explanation
Chooses the retriever variant and *peels out* its compressor so timing can be explicit.

---

## `rag/services/chatbot.py` — **CORE**

### Purpose
Builds chat models ("LLMs") and the conversational chain. Mirrors the legacy
`RAG_app.py` provider logic.

### Module constant (verified)
`DEFAULT_MODELS = {"openai": "gpt-4-turbo-preview", "google": "gemini-2.5-flash",
"huggingface": "mistralai/Mistral-7B-Instruct-v0.2"}`

### Functions

#### `default_model(provider: str) -> str`
Returns `DEFAULT_MODELS.get(provider, "")`.

#### `_build_llms(provider, api_key, model, temperature, top_p)` → `(condense_llm, response_llm)`
- **openai:** `ChatOpenAI(api_key, model, temperature=0.1, streaming=True)` for
  condense; `ChatOpenAI(api_key, model, temperature=user temp,
  model_kwargs={"top_p": top_p}, streaming=True)` for response.
- **google:** both `ChatGoogleGenerativeAI(google_api_key, model,
  convert_system_message_to_human=True, streaming=True)`; condense temp 0.1, response
  temp=user `temperature` + `top_p`.
- **huggingface:** `HuggingFaceHub(repo_id=model, huggingfacehub_api_token=api_key,
  model_kwargs={"temperature": ..., "top_p": top_p, "do_sample": True,
  "max_new_tokens": 1024})` for both.
- Unknown → `NotImplementedError(f"LLM provider '{provider}' not yet supported.")`.
- All models use `streaming=True` so TTFT can be measured in `execution.py`.

#### `build_chat_engine(retriever, llm_provider="google", model="", language="english",
memory_name="buffer", api_keys=None, temperature=0.5, top_p=0.95)` → `{"chain", "memory"}`
- `model = model or default_model(llm_provider)`.
- `condense_llm, response_llm = _build_llms(...)`.
- memory: `get_memory("summary")(llm=condense_llm)` if summary, else `get_memory(name)()`.
- chain: `get_chain("conversational")(retriever, standalone_query_generation_llm=
  condense_llm, response_generation_llm=response_llm, memory=memory,
  answer_prompt=get_prompt("answer")(language=language),
  condense_question_prompt=get_prompt("condense")())`.

### Callers
- `build_chat_engine` ← `rag/benchmarks/runner.py`.
- `_build_llms` ← `fastapi_app/routers/chat.py`.

### Beginner explanation
"Which LLM and which chain shape does this chat use?" Defaults to Google; defaults are
per-provider.

### Modification guide
Add a provider or change default models/streaming behavior.

---

## `rag/services/execution.py` — **CORE**

### Purpose
The explicit, stage-timed RAG pipeline. Every stage writes timing into a `trace` dict
the UI renders.

### Imports
- Module: `time`, `langchain_core.callbacks.BaseCallbackHandler`.
- Function-local: `langchain.chains.LLMChain`, `rag.services.retrieval.rerank_documents`.

### Class: `FirstTokenCallbackHandler(BaseCallbackHandler)`
Records TTFT (ms to first output token).
- `__init__`: `self.started = time.perf_counter()`, `self.ttft_ms = None`.
- `on_llm_new_token(token, **kwargs)`: if `ttft_ms is None`, set
  `ttft_ms = (perf_counter() - started) * 1000`.

### Function: `execute_pipeline(*, vectorstore, compressor, condense_llm, response_llm,
question, chat_history, answer_prompt, condense_question_prompt, k=16)` → dict
All params keyword-only. Returns `{"answer", "condensed_question", "final_docs",
"score_map", "trace"}`.

**Stage 1 — Query condensation** (`trace["condense_ms"]`):
- If `chat_history` non-empty, `LLMChain(llm=condense_llm,
  prompt=condense_question_prompt).invoke({"question": question, "chat_history":
  chat_history})`; extract `out.get("text") or out.get("output_text") or question`.
- Else `standalone = question`.

**Stage 2 — Vector search** (`trace["k_retrieved"]`, `trace["score_bounds"]`):
- `scored = vectorstore.similarity_search_with_score(standalone, k=k)`.
- `docs`, `scores` unpacked; `score_map = {doc.page_content: float(score) ...}`.

**Stage 3 — Rerank / compression** (`trace["rerank_ms"]`, `trace["k_filtered"]`):
- `final_docs = rerank_documents(compressor, docs, standalone)`.

**Stage 4 — LLM synthesis** (`trace["generation_ms"]`, `trace["ttft_ms"]`,
`trace["query_ms"]`):
- `context = "\n\n".join(final_docs contents)`.
- `prompt_messages = answer_prompt.format_prompt(question=standalone,
  chat_history=chat_history, context=context).to_messages()`.
- `handler = FirstTokenCallbackHandler()`.
- Try `response_llm.stream(prompt_messages, config={"callbacks": [handler]})`,
  joining `chunk.content` (fallbacks: `chunk.text`, raw `chunk`).
- On `NotImplementedError`/`TypeError` fall back to `response_llm.invoke(...)`.

### Callers
- `execute_pipeline` ← `fastapi_app/routers/chat.py::chat` (with `k=16`).

### Beginner explanation
The "MLOps cockpit" of the chat flow: it runs condensation → search → rerank →
synthesis explicitly and measures each. The trace dict becomes `ChatResponse.trace` and
the UI's `PipelineTrace` panel.

### Modification guide
Add/reorder stages, change search scoring, or adjust the callback logic.

---

## `rag/embeddings/` — IMPORTANT

### `__init__.py`
- Imports `rag.embeddings.{google, huggingface, openai}`.
- `_REGISTRY = {"openai": openai.create_openai_embeddings, "google":
  google.create_google_embeddings, "huggingface": huggingface.create_hf_embeddings}`.
- `get_embeddings_factory(name)` (KeyError w/ available list), `list_embeddings()`.
- **Called by:** `rag/services/ingestion.py`, `rag/benchmarks/runner.py`,
  `fastapi_app/routers/chat.py`.

### `openai.py`
- `create_openai_embeddings(api_key="")` → `OpenAIEmbeddings(api_key=api_key)`.
- Model: LangChain default (`text-embedding-ada-002`).

### `google.py`
- `create_google_embeddings(api_key="")` →
  `GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001",
  google_api_key=api_key)`, **then calls `embeddings.embed_query("validation test")`** —
  a live API probe at construction time. With no valid `GEMINI_API`, constructing this
  factory will raise.

### `huggingface.py`
- `create_hf_embeddings(api_key="")` →
  `HuggingFaceInferenceAPIEmbeddings(api_key=api_key, model_name="thenlper/gte-large")`.

### Modification guide
Add `create_x_embeddings` + register in `embeddings/__init__.py`.

---

## `rag/vectorstores/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"chroma": chroma.create_chroma_vectorstore}`; `get_vectorstore_factory`,
  `list_vectorstores`.
- **Called by:** `rag/services/ingestion.py`, `fastapi_app/routers/vectorstores.py`.

### `chroma.py`
- `create_chroma_vectorstore(embedding, persist_directory="")` → closure `create(documents)`
  → `Chroma.from_documents(documents, embedding, persist_directory)`.
- `load_chroma_vectorstore(embedding, persist_directory="")` →
  `Chroma(embedding_function=embedding, persist_directory=persist_directory)`.
- **Callers:** `create_*` ← ingestion; `load_*` ← `fastapi_app/routers/chat.py`.

### Modification guide
Swap/add a vectorstore backend (e.g. FAISS, Qdrant) here and register it.

---

## `rag/loaders/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"directory": directory_loader.create_directory_loader}`; `get_loader`,
  `list_loaders`.

### `directory_loader.py`
- `create_directory_loader(tmp_dir="")` builds four LangChain `DirectoryLoader`s
  (each with `show_progress=True`) and returns a closure `load()` that concatenates them:
  | glob | loader_cls |
  | ---- | ---------- |
  | `**/*.txt` | `TextLoader` |
  | `**/*.pdf` | `PyPDFLoader` |
  | `**/*.csv` | `CSVLoader` (encoding `utf8`) |
  | `**/*.docx` | `Docx2txtLoader` |
- **Called by:** `rag/services/ingestion.py::load_documents`.

### Modification guide
Add a new file type by adding a `DirectoryLoader` line here.

---

## `rag/splitters/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"recursive": recursive.create_recursive_splitter, "character":
  character.create_character_splitter}`; `get_splitter`, `list_splitters`.

### `recursive.py`
- `create_recursive_splitter(chunk_size=1600, chunk_overlap=200)` →
  `RecursiveCharacterTextSplitter(...)`. Uses the legacy defaults.

### `character.py`
- `create_character_splitter(chunk_size=500, chunk_overlap=0, separator=". ")` →
  `CharacterTextSplitter(...)`. Used by the compression retriever.
- **Imported at module level by** `rag/retrievers/contextual_compression.py` (the only
  cross-package implementation-level import).

### Modification guide
Add splitters here + register.

---

## `rag/retrievers/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"base": base.create_base_retriever, "contextual_compression":
  contextual_compression.create_compression_retriever, "cohere_rerank":
  cohere_rerank.create_cohere_rerank_retriever}`; `get_retriever_factory`,
  `list_retrievers`.

### `base.py`
- `create_base_retriever(vectorstore, search_type="similarity", k=16,
  score_threshold=None)` → `vectorstore.as_retriever(search_type, search_kwargs)`.

### `contextual_compression.py`
- `create_compression_retriever(embeddings, base_retriever, k=16,
  similarity_threshold=None, chunk_size=500)` builds a `DocumentCompressorPipeline` of:
  1. `create_character_splitter(chunk_size=chunk_size)`
  2. `EmbeddingsRedundantFilter(embeddings=embeddings)`
  3. `EmbeddingsFilter(embeddings=embeddings, k=k, similarity_threshold=...)`
  4. `LongContextReorder()`
  wrapped in `ContextualCompressionRetriever`.
- Imports (module-level): `rag.splitters.character.create_character_splitter`.

### `cohere_rerank.py`
- `create_cohere_rerank_retriever(base_retriever, cohere_api_key="",
  cohere_model="rerank-multilingual-v3.0", top_n=10)` → `ContextualCompressionRetriever`
  with `CohereRerank` compressor.
- `.base_compressor` attribute is what `build_retriever` extracts for the pipeline.

### Modification guide
Add retriever variants here + register; ensure the factory exposes
`base_compressor` if it should be timed/used by `execute_pipeline`.

---

## `rag/memory/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"buffer": buffer.create_buffer_memory, "summary":
  summary.create_summary_memory}`; `get_memory`, `list_memory_types`.

### `buffer.py`
- `create_buffer_memory()` → `ConversationBufferMemory(return_messages=True,
  memory_key="chat_history", output_key="answer", input_key="question")`.
- Takes no args.

### `summary.py`
- `create_summary_memory(llm, max_token_limit=1024)` →
  `ConversationSummaryBufferMemory(max_token_limit, llm, return_messages=True,
  memory_key="chat_history", output_key="answer", input_key="question")`.

### Beginner explanation
`buffer` keeps all turns; `summary` summarizes older turns to fit the LLM window. When
the UI selects `memory: "summary"`, the chat router passes `condense_llm` in.

---

## `rag/prompts/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"answer": answer.create_answer_prompt, "condense":
  condense.create_condense_question_prompt}`; `get_prompt`, `list_prompts`.

### `answer.py`
- `answer_template(language="english")` → the answer prompt string with `{chat_history}`,
  `{context}`, `{question}` and a `Language: {language}.` instruction.
- `create_answer_prompt(language="english")` →
  `ChatPromptTemplate.from_template(answer_template(language))`.

### `condense.py`
- `create_condense_question_prompt()` → `PromptTemplate(input_variables=
  ["chat_history", "question"], template="Given the following conversation and a follow
  up question, rephrase the follow up question to be a standalone question, in its
  original language. ...")`.

### Modification guide
Adjust LLM instructions here (system-prompt-style changes).

---

## `rag/chains/` — IMPORTANT

### `__init__.py`
- `_REGISTRY = {"conversational": conversational.create_conversational_chain}`;
  `get_chain`, `list_chains`.

### `conversational.py`
- `create_conversational_chain(retriever, standalone_query_generation_llm,
  response_generation_llm, memory, answer_prompt, condense_question_prompt,
  chain_type="stuff")` → `ConversationalRetrievalChain.from_llm(
  condense_question_prompt=..., combine_docs_chain_kwargs={"prompt": answer_prompt},
  condense_question_llm=..., llm=..., memory=..., retriever=..., chain_type="stuff",
  verbose=False, return_source_documents=True)`.
- **Callers:** `rag/services/chatbot.py::build_chat_engine`,
  `fastapi_app/routers/chat.py` (via the pipeline, indirectly); benchmark builds chains
  too.

### Beginner explanation
The full chain the benchmark path uses (`build_chat_engine`). The chat **API** path
deliberately does *not* call it — it runs the explicit `execute_pipeline` instead.

---

## `rag/benchmarks/` — IMPORTANT

### `__init__.py`
Docstring only: "Benchmarking component variants against a fixed corpus."

### `metrics.py`
- `Metrics` context manager: `__enter__` records `perf_counter()`, `__exit__` sets
  `self.elapsed_ms`. Used to time stages.
- `to_report(metrics)` → `{"metrics": ..., "unit": {"elapsed": "ms", "tokens": "count",
  "cost": "usd"}}`. **No in-repo callers** (verified). Docstring promises tokens/cost/
  relevance metrics, but only latency is implemented.

### `runner.py`
- Constants: `DEFAULT_EMBEDDINGS = "openai"`, `DEFAULT_RETRIEVER = "base"`.
- `build_matrix(config_matrix: dict[str, list[str]]) -> list[dict]`: Cartesian product
  expansion, e.g. `{"embeddings": ["openai","google"], "retrievers": ["base",
  "cohere_rerank"]}` → 4 variant dicts. Empty input → `[]`.
- `run_benchmark(run)` (synchronous):
  1. Set status `RUNNING`, `started_at`.
  2. For each variant:
     - label = `f"{embeddings_name} x {retriever_name}"`.
     - scratch persist dir = `TMP_DIR / f"bench_run_{run.pk}_{i}"`.
     - time `ingest_documents(tmp_dir=BENCHMARK_CORPUS_DIR, embeddings_name, ...)`.
     - rebuild embeddings, `build_retriever`, `build_chat_engine(..., llm_provider=
       "google", memory_name="buffer", ...)`.
     - time `engine["chain"].invoke({"question": settings.BENCHMARK_QUESTIONS[0]})`;
       record `answer_sample` (200 chars), `source_count`, `ingestion_ms`, `query_ms`,
       `status`.
     - exception → record `status="error"`, `error=str(exc)`.
     - persist `results_json = {"results": [...]}` after each variant.
  3. Final `status = COMPLETED` (outer exception → `FAILED` + `fatal_error`).
  4. `finally`: set `finished_at`.
- **Callers:** `build_matrix`, `run_benchmark` ← `fastapi_app/routers/benchmarks.py`.

### Beginner explanation
Loops embeddings × retriever variants against the fixed corpus, times ingestion and
query per variant, persists everything on the `BenchmarkRun` row. Runs in the request.

---

## Cross-package import summary (verified)

Module-level internal edges in `rag/`:
```
rag/registry.py → prompts, loaders, splitters, embeddings, vectorstores, retrievers, memory, chains
embeddings/__init__ → embeddings.openai, embeddings.google, embeddings.huggingface
loaders/__init__   → loaders.directory_loader
splitters/__init__ → splitters.character, splitters.recursive
vectorstores/__init__ → vectorstores.chroma
retrievers/__init__ → retrievers.base, retrievers.contextual_compression, retrievers.cohere_rerank
memory/__init__    → memory.buffer, memory.summary
prompts/__init__   → prompts.answer, prompts.condense
chains/__init__    → chains.conversational
retrievers/contextual_compression.py → splitters.character   (implementation-level cross edge)
benchmarks/runner.py → benchmarks.metrics, services.ingestion, services.retrieval, services.chatbot
```

Function-local (deferred) edges that matter at runtime:
```
services/ingestion.load_documents → loaders.get_loader("directory")
services/ingestion.ingest_documents → splitters.get_splitter, embeddings.get_embeddings_factory, vectorstores.get_vectorstore_factory, load_documents
services/retrieval.build_retriever → retrievers.get_retriever_factory (base / cohere_rerank / contextual_compression)
services/chatbot.build_chat_engine → chains.get_chain, memory.get_memory, prompts.get_prompt, _build_llms
services/execution.execute_pipeline → services.retrieval.rerank_documents, LLMChain, vectorstore.similarity_search_with_score, response_llm.stream/invoke
benchmarks/runner.run_benchmark → services.ingestion.ingest_documents, embeddings.get_embeddings_factory, services.retrieval.build_retriever, services.chatbot.build_chat_engine
```