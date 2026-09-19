"""Metric collection for benchmark runs (latency, tokens, cost, relevance)."""

from time import perf_counter


class Metrics:
    """Context manager that records wall-clock duration of a call."""

    def __init__(self):
        self.elapsed_ms = 0.0

    def __enter__(self):
        self._start = perf_counter()
        return self

    def __exit__(self, *exc):
        self.elapsed_ms = (perf_counter() - self._start) * 1000
        return False


def to_report(metrics: dict) -> dict:
    """Normalize collected metrics into a serializable report dict."""
    return {"metrics": metrics, "unit": {"elapsed": "ms", "tokens": "count", "cost": "usd"}}