# RAG Bot — Developer Documentation

> Reverse-engineered, beginner-friendly documentation for the **RAG Bot** repository —
> a monolithic RAG chatbot (Django 5.2 ORM + FastAPI REST + React/Vite frontend) with
> pluggable RAG components (loaders, splitters, embeddings, vectorstores, retrievers,
> memory, prompts, chains) and a benchmark suite.
>
> **Everything here is derived from the actual source code.** Relationships that could
> not be verified from source are explicitly marked `UNKNOWN / NEEDS VERIFICATION`.

## Where should I go?

| If you want to… | Start at |
| --------------- | -------- |
| Know what this repo is | [00_PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) |
| See the folder layout | [01_REPOSITORY_STRUCTURE.md](01_REPOSITORY_STRUCTURE.md) |
| Understand how everything fits together | [02_ARCHITECTURE.md](02_ARCHITECTURE.md) |
| Read about each source file | [03_FILE_DOCUMENTATION.md](03_FILE_DOCUMENTATION.md) → `files/` |
| See which files import/depend on which | [04_FILE_GRAPH.md](04_FILE_GRAPH.md) |
| See core functions and their callers | [05_FUNCTION_GRAPH.md](05_FUNCTION_GRAPH.md) |
| Get the complete API reference | [06_API_DOCUMENTATION.md](06_API_DOCUMENTATION.md) |
| See how each API flows through the code | [07_API_PIPELINE.md](07_API_PIPELINE.md) → `pipelines/` |
| Follow how data moves (runtime) | [08_DATA_FLOW.md](08_DATA_FLOW.md) |
| Understand the database and models | [09_DATABASE.md](09_DATABASE.md) |
| Learn about authentication | [10_AUTHENTICATION.md](10_AUTHENTICATION.md) |
| See every configuration surface | [11_CONFIGURATION.md](11_CONFIGURATION.md) |
| Know about external services (OpenAI/Gemini/HF/Cohere/Chroma) | [12_EXTERNAL_SERVICES.md](12_EXTERNAL_SERVICES.md) |
| Find out how the project is (not) tested | [13_TESTING.md](13_TESTING.md) |
| Trace process startup and the main flows | [14_EXECUTION_FLOW.md](14_EXECUTION_FLOW.md) |
| Map a feature to its implementation chain | [15_FEATURE_MAP.md](15_FEATURE_MAP.md) |
| Fix a problem by symptom | [16_DEBUGGING_GUIDE.md](16_DEBUGGING_GUIDE.md) |
| Onboard as a new developer | [17_DEVELOPER_ONBOARDING.md](17_DEVELOPER_ONBOARDING.md) |

## Sub-documents

| Deep dive | Guides |
| --------- | ------ |
| Per-file documentation | `files/root-and-config.md`, `files/backend-config-core.md`, `files/backend-fastapi.md`, `files/backend-rag-engine.md`, `files/frontend.md` |
| Per-API pipelines | `pipelines/chat.md`, `pipelines/ingestion.md`, `pipelines/vectorstores.md`, `pipelines/benchmarks.md`, `pipelines/health.md` |

## Suggested reading order

For a first pass, read in numeric order `00` → `09` (skipping detail documents as
needed), then use `06`/`07` for API work and `15`–`17` for feature work and onboarding.

The single most important concept is the **registry pattern** behind the RAG engine
(`backend/rag/registry.py` + each component package's `_REGISTRY`/`get_*`) — see
`02_ARCHITECTURE.md` before anything else.

## Scope & conventions used in these docs

- **Compiled from source only.** No assumptions beyond what the code shows; anything
  unverifiable is flagged.
- **No secrets.** Only environment-variable *names* are shown (e.g. `GEMINI_API`),
  never values.
- **Verified quirks** noted throughout (e.g. the "Knowlborder" typo, the unused
  `createVectorStore` client method, stateless chat).
- The legacy Streamlit app (`RAG_app.py`) and notebook are documented **as reference
  only**; they are not part of the main runtime.

> ⚠️ **Constraint:** These docs may not always mirror a future code change. If you
> modify source code, keep the relevant docs up to date.