# files/frontend.md — React frontend

> Covers every file under `frontend/`. Stack (verified from `package.json`): React 19,
> Vite 8, TypeScript ~6.0, Tailwind CSS v4, Radix UI primitives (dialog, popover,
> scroll-area, select, tooltip), `class-variance-authority`, `clsx`, `tailwind-merge`,
> `lucide-react` icons, `react-router-dom` v7, `@tanstack/react-virtual`,
> `react-markdown`, `highlight.js`, Fontsource variable fonts. Lint via **oxlint**;
> build via `tsc -b && vite build`; **no test framework**.

## Routing / app shell

### `frontend/src/main.tsx` — IMPORTANT
- Purpose: React root. Renders `<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>`
  into `#root`; imports Inter + JetBrains Mono fonts and `index.css`.
- Imports: `react-dom/client`, `react-router-dom.BrowserRouter`, font packages, `./index.css`, `./App.tsx`.

### `frontend/src/App.tsx` — IMPORTANT
- Purpose: lays out `NavRail` + `<main>` with `<Routes>`.
- Routes (verified):
  | path | element |
  | ---- | ------- |
  | `/` | `<ChatWorkspace/>` |
  | `/stores` | `<StoresView/>` |
  | `/benchmarks` | `<BenchmarksLab/>` |
  | `*` | `<Navigate to="/" replace/>` |
- Wraps everything in `<TraceProvider>` so chat traces + chunk focus are global.
- Imports: `react-router-dom`, `NavRail`, `TraceProvider`, `ChatWorkspace`, `StoresView`, `BenchmarksLab`.

### `frontend/src/index.css` — SUPPORTING
- Purpose: Tailwind v4 entry (`@import 'tailwindcss'`), `@theme` design tokens (dark
  palette: `--color-canvas`, `--color-surface`, `--color-primary` indigo, etc.), global
  typography/markdown styles (`.markdown-body`, `.hljs`, `.trace-mono`), thin scrollbars.
- Modification guide: change the design system here (colors/fonts).

### `frontend/vite.config.ts` — IMPORTANT
- Plugins: `react()`, `tailwindcss()`.
- Dev server: port `5173`; proxy `/api`, `/admin`, `/static` → `http://127.0.0.1:8000`.
- Modification guide: ports/proxy targets.

### `frontend/package.json`, `tsconfig*.json`, `.oxlintrc.json`, `index.html`, `public/`, `dist/`
- Package scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (oxlint), `preview`.
- `.oxlintrc.json`: plugins react/typescript/oxc; rules-of-hooks + only-export-components.
- `dist/`: gitignored build output (present locally).

## Data types + API client

### `frontend/src/models.ts` — **CORE**
- Purpose: the TypeScript contract mirroring `backend/fastapi_app/schemas.py`.
- Key types (verified): `EmbeddingProvider = 'openai'|'google'|'huggingface'`;
  `RetrieverName = 'base'|'contextual_compression'|'cohere_rerank'`;
  `MemoryName = 'buffer'|'summary'`; `Health`; `VectorStore`;
  `RetrievalSource` (source, page, chunk_index, chunk_hash, score, tokens,
  retrieval_ms, content); `ExecutionTrace` (query/retrieval/rerank/ttft/condense/
  generation ms, token_estimate, k_retrieved, k_filtered, condensed_question,
  chunk_size, chunk_overlap, language, file_types, retriever, score_bounds, sources);
  `ChatMessage`; `ChatResponse`; `PipelineSettings`; `BenchmarkRun`.
- Modification guide: keep in sync with `backend/fastapi_app/schemas.py` when changing the API.

### `frontend/src/api/client.ts` — **CORE**
- Purpose: every backend call. All methods use `fetch` against Vite-proxied relative URLs.
- `handle<T>(res)` helper: parses JSON; on `!res.ok` throws `Error(detail)` using the
  body's `detail` string if present, else `HTTP <status>`.
- Methods (verified):
  | Method | HTTP call | Purpose |
  | ------ | --------- | ------- |
  | `getHealth()` | GET `/api/health` | Health check |
  | `getVectorStores()` | GET `/api/vectorstores` | Stores (django + persisted + engine_variants) |
  | `createVectorStore(name, provider)` | POST `/api/vectorstores` | Create store record (**no UI caller** — verified quirk) |
  | `uploadDocuments({vectorStore, provider, files, chunkSize=1600, chunkOverlap=200})` | POST `/api/documents?...` (multipart `files`) | Ingest uploaded files |
  | `sendChat({vector_store, question, llm_provider, model, retriever, memory='buffer', temperature=0.5, top_p=0.95})` | POST `/api/chat` | Ask with RAG |
  | `runBenchmark(configMatrix)` | POST `/api/benchmarks` | Run benchmark (matrix) |
  | `listBenchmarks()` | GET `/api/benchmarks` | List runs |
- Behavior: `sendChat` hardcodes `language: 'english'`; `uploadDocuments` defaults
  chunk_size 1600 / chunk_overlap 200 (matching backend defaults).
- Modification guide: change API surface here; keep method names in sync with callers.

## Views

### `frontend/src/views/ChatWorkspace.tsx` — **CORE**
- Purpose: the `/` page. Three-pane flex layout:
  `<StoresRail selectedStore onSelectStore refreshKey onStoresChanged/> <ChatCanvas
  store={selectedStore}/> <PipelineTrace/>`.
- State: `selectedStore` (VectorStore|null), `refreshKey` (number) — increments when
  stores change to force StoresRail refetch.
- Imports: `StoresRail`, `ChatCanvas`, `PipelineTrace`, `models.VectorStore`.

## Layout / workspace components

### `frontend/src/components/layout/NavRail.tsx` — SUPPORTING
- Purpose: left sidebar with brand + `NavLink`s to `/` (Chat), `/stores`, `/benchmarks`
  (active styling). Calls `getHealth()` on mount to show backend status pill.
- Imports: `react-router-dom`, `api/client.getHealth`, `lib/cn`, UI kit.

### `frontend/src/components/workspace/StoresRail.tsx` — IMPORTANT
- Purpose: lists vectorstores on the chat page, lets user select one; "New Knowledge
  Base" button opens `IngestionModal`.
- Props (approx.): `selectedStore`, `onSelectStore`, `refreshKey`, `onStoresChanged`.
- Fetches via `getVectorStores()`; `useEffect` depends on `refreshKey` to refetch after
  ingestion.
- Imports: `api/client`, `models`, `IngestionModal`, UI kit.

## Chat components

### `frontend/src/components/chat/ChatCanvas.tsx` — **CORE**
- Purpose: the chat panel — message list, input, send, drag-and-drop upload → ingestion.
- Props: `{ store: VectorStore | null; onStoresChanged?: () => void }`.
- State: `messages` (`ChatMessage[]`), `input`, `busy`, `error`, `pipeline`
  (`PipelineSettings` default `{provider:'google', model:'gemini-2.5-flash',
  retriever:'base', memory:'buffer'}`), `modalOpen`, `pendingFiles`, `dragOver`.
- Trace wiring: uses `useTrace()` → `setTrace`, `focus`.
- Behavior (verified):
  - `handleSend`: guards empty input / no store; appends user message; calls
    `sendChat({... pipeline fields, vector_store: store.name, question})`; appends
    assistant message with `trace: res.trace`; calls `setTrace(res.trace)`; on error
    sets `error` and appends an error message. Clears input.
  - Message virtualization via `@tanstack/react-virtual` (`useVirtualizer`, estimate 180).
  - `useEffect` on `store?.name` resets messages to a welcome message, clears error/trace.
  - Drag/drop of `.pdf/.txt/.csv/.docx` → opens `IngestionModal` with pending files.
  - `lastTrace` = most recent message with a trace (for header latency badge).
- Verified quirk: `onStoresChanged` prop is declared but never passed by
  `ChatWorkspace`; `handleIngested` guards with `onStoresChanged?.()`.

### `frontend/src/components/chat/MessageBubble.tsx` — IMPORTANT
- Purpose: renders one `ChatMessage` (role styling), markdown answer via
  `react-markdown` + custom `code` renderer using `highlight.ts`, and a row of
  `SourceBadge`s when `message.trace?.sources` exist.
- Imports: `react-markdown`, `models`, `SourceBadge`, `TraceContext`, `lib/highlight`, UI kit.

### `frontend/src/components/chat/SourceBadge.tsx` — IMPORTANT
- Purpose: renders a single source chunk badge (source file, page, score, tokens).
- Clicking calls `focus(source, trace)` to spotlight the chunk in the trace panel too.
- Imports: `TraceContext`, `lib/format`, UI kit.

### `frontend/src/components/chat/PipelineSettingsPopover.tsx` — IMPORTANT
- Purpose: popover to pick `provider` (openai/google/huggingface), `model` (text input),
  `retriever` (base/contextual_compression/cohere_rerank), `memory` (buffer/summary).
- Values flow into `ChatCanvas.pipeline` → `sendChat`.
- Imports: `models`, UI kit (popover, select, input).

## Telemetry

### `frontend/src/components/telemetry/TraceContext.tsx` — IMPORTANT
- Purpose: global context holding `trace` (current `ExecutionTrace`), `setTrace`,
  `focusSource`/`focusTrace`, and `focus(source, traceOverride?)` which sets the focused
  source (+ trace). `useTrace()` hook errors if used outside `TraceProvider`.
- Provider mounted in `App.tsx`.

### `frontend/src/components/telemetry/PipelineTrace.tsx` — IMPORTANT
- Purpose: right-hand "MLOps cockpit" panel rendering the 4-stage pipeline
  (condense → retrieve → rerank → synthesize) from `trace`, with per-stage ms readouts
  and source chips. Renders `trace` from context (or `focusTrace` when a chunk is
  focused). Internal `Chunk` subcomponent.
- Imports: `TraceContext`, `lib/format`, UI kit.

## Ingestion / stores / benchmarks pages

### `frontend/src/components/IngestionModal.tsx` — IMPORTANT
- Purpose: dialog to create a knowledge base and/or upload documents.
  - Mode toggle: "New Knowlborder Base" / "Existing Base" (typo is **in the source** —
    verified quirk, see `StoresView` too).
  - New base: name + chunk size/overlap + embedding provider.
  - Existing base: pick store, add files.
  - Upload → `uploadDocuments(...)` → on success `onComplete(storeName)`.
- Imports: `api/client`, `models`, UI kit.

### `frontend/src/components/StoresView.tsx` — IMPORTANT
- Purpose: `/stores` page listing all stores with document counts; lets you open a store
  in chat (`<Link to="/">`), and "Create Knowlborder Base" → `IngestionModal`.
- Verified quirk: "Knowlborder" typo appears in headings/buttons here and in
  `IngestionModal`.

### `frontend/src/components/BenchmarksLab.tsx` — IMPORTANT
- Purpose: `/benchmarks` page.
  - Select embeddings variants (openai/google/huggingface) and retriever variants
    (base/contextual_compression/cohere_rerank) via checkboxes; a `name` text input that
    is **collected but never sent** (verified quirk — backend assigns default "Benchmark").
  - "Run benchmark" → `runBenchmark({config_matrix: {embeddings, retrievers: ...}})`.
  - Lists runs via `listBenchmarks()`; renders `results_json.results` rows
    (embeddings, retriever, ingestion_ms, query_ms, status).
- Imports: `api/client`, `models`, UI kit.

## UI kit (`frontend/src/ui/*`) — SUPPORTING

Hand-rolled wrappers over Radix primitives + Tailwind + `cva` + `cn()`. All use
`cn` from `lib/cn`. Verified contents:

| File | Wraps (Radix) | Exports |
| ---- | ------------- | ------- |
| `badge.tsx` | — | `Badge` (cva variants: default/secondary/outline/danger) |
| `button.tsx` | — | `buttonVariants` + `Button` (variants/sizes via cva) |
| `dialog.tsx` | `react-dialog` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, close button |
| `input.tsx` | — | `Input`, `Textarea` (Textarea currently unused — verified) |
| `popover.tsx` | `react-popover` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` |
| `scroll-area.tsx` | `react-scroll-area` | `ScrollArea`, `ScrollBar` |
| `select.tsx` | `react-select` | `Select`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectItem` (+ scroll buttons) |
| `tooltip.tsx` | `react-tooltip` | `TooltipProvider`, `TooltipRoot`, `TooltipTrigger`, `TooltipContent` |

## Helpers

### `frontend/src/lib/cn.ts` — SUPPORTING
`cn(...inputs)` = `twMerge(clsx(inputs))` — combine class names safely.

### `frontend/src/lib/format.ts` — SUPPORTING
`formatMs(ms)` (and helpers) for displaying durations (e.g. latency badges).

### `frontend/src/lib/highlight.ts` — SUPPORTING
Syntax-highlight theme setup for markdown code blocks (uses highlight.js).

### `frontend/src/vite-env.d.ts`
Vite type shim. `LOW PRIORITY`.

## Frontend → backend endpoint surface (complete list)

| Endpoint | Frontend caller | Backend handler | Status in UI |
| -------- | --------------- | --------------- | ------------ |
| `GET /api/health` | `client.getHealth` (NavRail) | `health.health` | used |
| `GET /api/vectorstores` | `client.getVectorStores` (StoresRail, StoresView) | `vectorstores.list_vectorstores` | used |
| `POST /api/vectorstores` | `client.createVectorStore` | `vectorstores.create_vectorstore` | **client method unused by UI** |
| `POST /api/documents` | `client.uploadDocuments` (IngestionModal) | `ingestion.ingest_documents` | used |
| `POST /api/chat` | `client.sendChat` (ChatCanvas) | `chat.chat` | used |
| `POST /api/benchmarks` | `client.runBenchmark` (BenchmarksLab) | `benchmarks.create_benchmark` | used |
| `GET /api/benchmarks` | `client.listBenchmarks` (BenchmarksLab) | `benchmarks.list_benchmarks` | used |
| `GET /api/benchmarks/{id}` | (no client method) | `benchmarks.get_benchmark` | unused by frontend |

## Verified frontend quirks (as shipped)

1. "Knowlborder Base" typo in `IngestionModal.tsx` and `StoresView.tsx`.
2. `createVectorStore` client method unused; stores are created implicitly via
   `POST /api/documents`.
3. `BenchmarksLab` collects a run `name` that is never sent.
4. `ChatCanvas.onStoresChanged` prop never passed by `ChatWorkspace`.
5. `engine_variants` from vectorstores response received but not rendered.
6. Dev proxy assumes backend reaches us at `http://127.0.0.1:8000`.

See `16_DEBUGGING_GUIDE.md` for troubleshooting these.