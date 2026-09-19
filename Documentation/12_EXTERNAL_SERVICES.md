# 12 — External Services

> Every external API/integration the backend calls, with the exact file that initiates
> the call and how keys reach it.

---

## Overview

| Service | Used for | Key env var (name only) | API key dict key |
| ------- | -------- | ----------------------- | ---------------- |
| OpenAI | Embeddings (`text-embedding-ada-002`) + Chat LLM (`gpt-4-turbo-preview`) | `OPENAI_API` | `API_KEYS["openai"]` |
| Google Gemini | Embeddings (`models/gemini-embedding-001`) + Chat LLM (`gemini-2.5-flash`) | `GEMINI_API` | `API_KEYS["google"]` (also `["gemini"]`) |
| HuggingFace Inference | Embeddings (`thenlper/gte-large`) + Chat LLM (`mistralai/Mistral-7B-Instruct-v0.2`) | `HF_API` | `API_KEYS["huggingface"]` |
| Cohere | Reranking (`rerank-multilingual-v3.0`) | `COHERE_API` | `API_KEYS["cohere"]` |
| Chroma | Local vector DB | — (on-disk) | — |

---

## OpenAI integration

### Embeddings
- **File:** `backend/rag/embeddings/openai.py::create_openai_embeddings`
- **Client:** `langchain_openai.OpenAIEmbeddings(api_key=...)`
- **Model:** LangChain default (`text-embedding-ada-002`)
- **When called:** every `POST /api/documents` (ingestion) and `POST /api/chat` (to build
  the embeddings object), plus every `run_benchmark` variant using `openai`.

### Chat LLM
- **File:** `backend/rag/services/chatbot.py::_build_llms`
- **Client:** `langchain_openai.ChatOpenAI(api_key, model, temperature, model_kwargs,
  streaming=True)`
- **Model:** `"gpt-4-turbo-preview"` (default in `chatbot.py:DEFAULT_MODELS`)
- **Params:** condense uses `temperature=0.1`; response uses user-provided `temperature`
  + `top_p`.
- **When called:** every `POST /api/chat` with `llm_provider: "openai"`, plus
  benchmarks with that provider.

---

## Google Gemini integration

### Embeddings
- **File:** `backend/rag/embeddings/google.py::create_google_embeddings`
- **Client:** `langchain_google_genai.GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001",
  google_api_key=...)`
- **Model:** `"models/gemini-embedding-001"` (hardcoded)
- **Live probe:** calls `embed_embeddings.embed_query("validation test")` at construction
  time — **fails immediately with no valid key** (500 from the ingestion API).

### Chat LLM
- **File:** `backend/rag/services/chatbot.py::_build_llms`
- **Client:** `langchain_google_genai.ChatGoogleGenerativeAI(google_api_key, model,
  convert_system_message_to_human=True, streaming=True, temperature, top_p)`
- **Model:** `"gemini-2.5-flash"` (default in `DEFAULT_MODELS`)
- **Params:** condense temp 0.1; response uses user temp + top_p.
- **`convert_system_message_to_human=True`** — LangChain flag; Google API does not
  support the system message role directly, so LangChain converts it.

### When called (both)
Default provider is `"google"` — without a valid `GEMINI_API`, **both ingestion and chat
fail**.

---

## HuggingFace Inference integration

### Embeddings
- **File:** `backend/rag/embeddings/huggingface.py::create_hf_embeddings`
- **Client:** `langchain_community.embeddings.HuggingFaceInferenceAPIEmbeddings(api_key,
  model_name="thenlper/gte-large")`
- **Model:** `"thenlper/gte-large"` (hardcoded)

### Chat LLM
- **File:** `backend/rag/services/chatbot.py::_build_llms`
- **Client:** `langchain_community.llms.HuggingFaceHub(repo_id, huggingfacehub_api_token,
  model_kwargs={"temperature": ..., "top_p": top_p, "do_sample": True,
  "max_new_tokens": 1024})`
- **Model:** `"mistralai/Mistral-7B-Instruct-v0.2"` (hardcoded in `DEFAULT_MODELS`)

---

## Cohere integration

### Reranking
- **File:** `backend/rag/retrievers/cohere_rerank.py::create_cohere_rerank_retriever`
- **Client:** `langchain.retrievers.document_compressors.CohereRerank(cohere_api_key,
  model="rerank-multilingual-v3.0", top_n=10)`
- **Model:** `"rerank-multilingual-v3.0"` (hardcoded; note: legacy `RAG_app.py` used `v2.0`)
- **When called:** only when `retriever: "cohere_rerank"` is selected (via
  `rag.services.retrieval.build_retriever`).

### Key path
```text
COHERE_API (env)
 → settings.API_KEYS["cohere"]
 → chat.py / retrieval.py passes api_keys.get("cohere", "")
 → rag/retrievers/cohere_rerank.py cohere_api_key param
 → CohereRerank(cohere_api_key=...)
```

---

## Chroma integration

### How it is called (file-level mapping)
| Operation | File | Function | Call |
| --------- | ---- | -------- | ---- |
| Create from documents | `rag/vectorstores/chroma.py` | `create_chroma_vectorstore(embedding, dir)` → closure `create(docs)` | `Chroma.from_documents(docs, embedding, persist_directory)` |
| Load existing | `rag/vectorstores/chroma.py` | `load_chroma_vectorstore(embedding, dir)` | `Chroma(embedding_function=embedding, persist_directory=dir)` |
| Similarity search | `rag/services/execution.py` | `execute_pipeline` | `vectorstore.similarity_search_with_score(query, k=16)` |

Chroma data lives at `data/vector_stores/<name>/` and is **shared with the legacy**
`RAG_app.py` (it scans the same directory for "Open a saved Vectorstore").

---

## How keys reach external services

```text
.env
 ↓ load_dotenv (settings.py:21)
settings.API_KEYS dict
 ↓
routers: api_keys = settings.API_KEYS
 ↓ passed as api_keys= to rag functions
 ↓
rag functions: api_keys.get(provider_name, "")
 ↓
provider constructors (OpenAI(api_key=…), CohereRerank(cohere_api_key=…), etc.)
```

**Important:** keys are **not** per-user. A single set of keys is shared by all API
requests. There is no key isolation between different frontend users (and there is
no auth — see `10_AUTHENTICATION.md`).

---

## Verified integration quirks

1. **Google embeddings live probe at construction:** any Google embeddings call will
   raise an HTTP 500 if `GEMINI_API` is empty or invalid — the error surfaces inside
   `rag/embeddings/google.py` as a failed `embed_query("validation test")` call.
2. **HF chat uses `max_new_tokens: 1024`** (hardcoded) — longer answers are truncated.
3. **`convert_system_message_to_human=True`** in Gemini chat — Google API does not support
   the system role natively; LangChain converts it to a human message.
4. **Cohere rerank model version:** `v3.0` (new code) vs `v2.0` (legacy `RAG_app.py`)
   — different results on the same data.
5. **Streamlit (`RAG_app.py`) is still a dependency** in `requirements.txt` (version
   `1.28.0`) and consumes provider keys if run separately; it is a separate process.
   Both Streamlit and the FastAPI app share `settings.API_KEYS` from the same `.env`.