"""Benchmarking harness for comparing component variants.

A benchmark matrix (e.g. multiple embeddings x retrievers) is expanded into
per-variant runs; each run ingests the fixed corpus (`data/benchmark/`) with
one embeddings variant and answers the eval questions through one retriever
variant, recording latency for both stages. Results are persisted on the
``core.BenchmarkRun`` record.
"""

from django.conf import settings
from django.utils import timezone

from rag.benchmarks.metrics import Metrics
from rag.services.ingestion import ingest_documents
from rag.services.retrieval import build_retriever
from rag.services.chatbot import build_chat_engine

DEFAULT_EMBEDDINGS = "openai"
DEFAULT_RETRIEVER = "base"


def build_matrix(config_matrix: dict[str, list[str]]) -> list[dict]:
    """Expand a component-variant matrix into individual run configs.

    Example input:
        {"embeddings": ["openai", "google"], "retrievers": ["base", "cohere_rerank"]}
    Example output:
        [{"embeddings": "openai", "retrievers": "base"}, ...]
    """
    if not config_matrix:
        return []

    keys = list(config_matrix)
    runs = [{}]
    for key in keys:
        runs = [{**run, key: value} for run in runs for value in config_matrix[key]]
    return runs


def run_benchmark(run) -> None:
    """Execute a single BenchmarkRun in the foreground and persist results."""
    from core.models import BenchmarkRun

    run.status = BenchmarkRun.Status.RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=["status", "started_at"])

    variants = (run.config_json or {}).get("runs") or []
    results = []

    try:
        for i, variant in enumerate(variants):
            embeddings_name = variant.get("embeddings", DEFAULT_EMBEDDINGS)
            retriever_name = variant.get("retrievers", DEFAULT_RETRIEVER)
            variant_label = f"{embeddings_name} x {retriever_name}"

            persist_directory = str(settings.TMP_DIR / f"bench_run_{run.pk}_{i}")
            entry = {"variant": variant, "label": variant_label}

            try:
                with Metrics() as ingestion_metrics:
                    ingested = ingest_documents(
                        tmp_dir=str(settings.BENCHMARK_CORPUS_DIR),
                        embeddings_name=embeddings_name,
                        persist_directory=persist_directory,
                        api_keys=settings.API_KEYS,
                    )
                entry["chunk_count"] = ingested["chunk_count"]

                from rag.embeddings import get_embeddings_factory

                embeddings = get_embeddings_factory(embeddings_name)(
                    api_key=settings.API_KEYS.get(embeddings_name, "")
                )
                vectorstore = ingested["vectorstore"]
                retriever_info = build_retriever(
                    vectorstore=vectorstore,
                    embeddings=embeddings,
                    retriever_name=retriever_name,
                    api_keys=settings.API_KEYS,
                )
                engine = build_chat_engine(
                    retriever=retriever_info["retriever"],
                    llm_provider="google",
                    language="english",
                    memory_name="buffer",
                    api_keys=settings.API_KEYS,
                )

                question = settings.BENCHMARK_QUESTIONS[0]
                with Metrics() as query_metrics:
                    response = engine["chain"].invoke({"question": question})
                entry["answer_sample"] = (response["answer"] or "")[:200]
                entry["source_count"] = len(response["source_documents"])
                entry["ingestion_ms"] = round(ingestion_metrics.elapsed_ms, 1)
                entry["query_ms"] = round(query_metrics.elapsed_ms, 1)
                entry["status"] = "ok"
            except Exception as exc:  # noqa: BLE001
                entry["status"] = "error"
                entry["error"] = str(exc)

            results.append(entry)
            run.refresh_from_db()
            run.results_json = {"results": list(results)}
            run.save(update_fields=["results_json"])

        run.status = BenchmarkRun.Status.COMPLETED
    except Exception as exc:  # noqa: BLE001
        run.status = BenchmarkRun.Status.FAILED
        run.results_json = {**run.results_json, "fatal_error": str(exc)}
    finally:
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "finished_at", "results_json"])