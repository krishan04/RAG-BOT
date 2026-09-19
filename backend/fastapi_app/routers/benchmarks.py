"""Benchmark endpoints: create, trigger and inspect benchmark runs."""

from fastapi import APIRouter, HTTPException

from fastapi_app.schemas import BenchmarkRunCreate, BenchmarkRunResponse
from rag.benchmarks.runner import build_matrix, run_benchmark

router = APIRouter()


@router.post("/benchmarks", response_model=BenchmarkRunResponse)
def create_benchmark(payload: BenchmarkRunCreate):
    """Persist and execute a benchmark run from a component-variant matrix."""
    from core.models import BenchmarkRun

    if not payload.config_matrix:
        raise HTTPException(status_code=422, detail="config_matrix must not be empty.")

    run = BenchmarkRun.objects.create(
        name=payload.name or "Benchmark",
        config_json={"config_matrix": payload.config_matrix, "runs": build_matrix(payload.config_matrix)},
    )
    run_benchmark(run)
    run.refresh_from_db()

    return BenchmarkRunResponse(
        id=run.id, name=run.name, status=run.status, config_json=run.config_json
    )


@router.get("/benchmarks")
def list_benchmarks():
    """List persisted benchmark runs."""
    from core.models import BenchmarkRun

    return list(
        BenchmarkRun.objects.values("id", "name", "status", "config_json", "results_json", "created_at")
    )


@router.get("/benchmarks/{run_id}")
def get_benchmark(run_id: int):
    """Return a single benchmark run with its results."""
    from core.models import BenchmarkRun

    run = BenchmarkRun.objects.filter(pk=run_id).first()
    if run is None:
        raise HTTPException(status_code=404, detail="Benchmark run not found.")
    return {
        "id": run.id,
        "name": run.name,
        "status": run.status,
        "config_json": run.config_json,
        "results_json": run.results_json,
        "created_at": run.created_at,
    }