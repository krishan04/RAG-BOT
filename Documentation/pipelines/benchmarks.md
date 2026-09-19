# Pipeline: Benchmarks — `POST/GET /api/benchmarks`

> Run and inspect component-variant benchmarks. Runs synchronously in the request.

## Frontend

```text
BenchmarksLab.tsx (/benchmarks)
 ├── select embeddings variants + retriever variants (checkboxes)
 ├── [name input collected but never sent — verified quirk]
 └── Run button
      ├── runBenchmark({config_matrix: {embeddings: [...], retrievers: [...]}})
      │     → fetch('/api/benchmarks', POST JSON)
      └── listBenchmarks() → fetch('/api/benchmarks', GET) → render runs + results table
```

## Backend — create

```text
backend/fastapi_app/routers/benchmarks.py :: create_benchmark(payload: BenchmarkRunCreate)
 1. 422 if not payload.config_matrix
 2. runs = rag.benchmarks.runner.build_matrix(config_matrix)   # cartesian product
 3. run = BenchmarkRun.objects.create(name=payload.name or "Benchmark",
        config_json={"config_matrix": …, "runs": runs})
 4. run_benchmark(run)               # SYNCHRONOUS (blocks the request)
 5. run.refresh_from_db()
 6. return BenchmarkRunResponse(id, name, status, config_json)
```

## The runner

```text
backend/rag/benchmarks/runner.py :: run_benchmark(run)

 status=RUNNING, started_at=now
 for i, variant in enumerate(runs):
   embeddings_name = variant.get("embeddings", "openai")
   retriever_name  = variant.get("retrievers", "base")
   label = f"{embeddings_name} x {retriever_name}"
   persist_directory = TMP_DIR / f"bench_run_{run.pk}_{i}"     # scratch space

   with Metrics() as m:                                        # ingest → ingestion_ms
     ingest_documents(tmp_dir=BENCHMARK_CORPUS_DIR, embeddings_name=…,
                      persist_directory=…, api_keys=settings.API_KEYS)

   embeddings = get_embeddings_factory(embeddings_name)(api_key)
   retriever_info = build_retriever(vectorstore, embeddings, retriever_name, api_keys)
   engine = build_chat_engine(retriever=…, llm_provider="google",
                              language="english", memory_name="buffer", api_keys=…)

   with Metrics() as m:                                        # query → query_ms
     resp = engine["chain"].invoke({"question": settings.BENCHMARK_QUESTIONS[0]})

   record {label, embeddings, retriever, chunk_count, ingestion_ms, query_ms,
           answer_sample (200 chars), source_count, status:"ok"}  (or error+error on exception)
   refresh_from_db(); save(update_fields=["results_json"])        # incremental persist

 status = COMPLETED   (outer exception → FAILED + fatal_error)
 finally: finished_at = now, save()
```

## Data

- Corpus: `data/benchmark/intro.txt` (`settings.BENCHMARK_CORPUS_DIR`).
- Questions: `settings.BENCHMARK_QUESTIONS[0]` = "What does this project do in one
  sentence?" (second question is unused by the runner — verified).
- Scratch Chroma under `backend/storage/tmp/bench_run_<run_pk>_<i>/` — survives runs.

## Response

```json
{
  "id": 4,
  "name": "…",
  "status": "completed",
  "config_json": {
    "config_matrix": {"embeddings": ["openai", "google"], "retrievers": ["base", "cohere_rerank"]},
    "runs": [
      {"embeddings": "openai", "retrievers": "base"},
      {"embeddings": "openai", "retrievers": "cohere_rerank"},
      {"embeddings": "google", "retrievers": "base"},
      {"embeddings": "google", "retrievers": "cohere_rerank"}
    ]
  }
}
```

## GET endpoints

- `GET /api/benchmarks` → list of
  `{id, name, status, config_json, results_json, created_at}`.
- `GET /api/benchmarks/{run_id}` → the single run (404 if missing).

## Errors

- `422` `{"detail": "config_matrix must not be empty."}`
- Per-variant failures are **captured inside `results_json.results`** (`status:
  "error"` + message); they do not fail the HTTP request.
- Unset provider keys (e.g. `OPENAI_API` missing) therefore appear as variant errors,
  not as HTTP 5xx.

## Key files

| Role | File |
| ---- | ---- |
| UI | `frontend/src/components/BenchmarksLab.tsx` |
| API client | `frontend/src/api/client.ts` |
| Router | `backend/fastapi_app/routers/benchmarks.py` |
| Runner | `backend/rag/benchmarks/runner.py` |
| Metrics | `backend/rag/benchmarks/metrics.py` |
| Corpus config | `backend/config/settings.py` |
| Persistence | `backend/core/models.py` (`BenchmarkRun`) |