"""Service orchestration: explicit, stage-timed RAG execution pipeline.

Condenses the question, retrieves scored chunks, reranks/compresses, then
synthesizes the answer. Every stage is timed and reported back in a trace so
the UI can render a per-node execution timeline (MLOps cockpit).
"""

import time

from langchain_core.callbacks import BaseCallbackHandler


class FirstTokenCallbackHandler(BaseCallbackHandler):
    """Records the time offset (ms) of the first LLM output token (TTFT)."""

    def __init__(self) -> None:
        super().__init__()
        self.started = time.perf_counter()
        self.ttft_ms: float | None = None

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        if self.ttft_ms is None:
            self.ttft_ms = (time.perf_counter() - self.started) * 1000


def execute_pipeline(
    *,
    vectorstore,
    compressor,
    condense_llm,
    response_llm,
    question: str,
    chat_history,
    answer_prompt,
    condense_question_prompt,
    k: int = 16,
):
    """Run the four RAG stages with per-stage timing.

    Returns a dict with ``answer``, ``condensed_question``, ``final_docs``,
    ``score_map`` and ``trace`` (all timings in milliseconds).
    """
    from langchain.chains import LLMChain

    from rag.services.retrieval import rerank_documents

    total_start = time.perf_counter()
    trace: dict = {}

    # --- Stage 1: query condensation ---------------------------------------
    condense_start = time.perf_counter()
    standalone = question
    if chat_history:
        condense_chain = LLMChain(llm=condense_llm, prompt=condense_question_prompt)
        out = condense_chain.invoke(
            {"question": question, "chat_history": chat_history}
        )
        standalone = (out.get("text") or out.get("output_text") or question).strip()
    trace["condense_ms"] = round((time.perf_counter() - condense_start) * 1000, 3)

    # --- Stage 2: vector search ----------------------------------------------
    search_start = time.perf_counter()
    scored = vectorstore.similarity_search_with_score(standalone, k=k)
    trace["retrieval_ms"] = round((time.perf_counter() - search_start) * 1000, 3)
    docs = [doc for doc, _ in scored]
    scores = [float(s) for _, s in scored]
    score_map = {doc.page_content: float(s) for doc, s in scored}
    trace["k_retrieved"] = len(scored)
    trace["score_bounds"] = (
        {"min": round(min(scores), 4), "max": round(max(scores), 4)}
        if scores
        else None
    )

    # --- Stage 3: rerank / compression ---------------------------------------
    rerank_start = time.perf_counter()
    final_docs = rerank_documents(compressor, docs, standalone)
    trace["rerank_ms"] = round((time.perf_counter() - rerank_start) * 1000, 3)
    trace["k_filtered"] = len(final_docs)

    # --- Stage 4: LLM synthesis (streamed for TTFT) ----------------------------
    context = "\n\n".join(doc.page_content for doc in final_docs)
    prompt_messages = answer_prompt.format_prompt(
        question=standalone, chat_history=chat_history, context=context
    ).to_messages()
    handler = FirstTokenCallbackHandler()
    synthesis_start = time.perf_counter()
    streamed = False
    chunks: list[str] = []
    try:
        for chunk in response_llm.stream(
            prompt_messages, config={"callbacks": [handler]}
        ):
            text = (
                getattr(chunk, "content", None)
                if not isinstance(chunk, str)
                else chunk
            )
            if text is None:
                text = getattr(chunk, "text", "")
            if text:
                chunks.append(text)
        streamed = True
    except (NotImplementedError, TypeError):
        streamed = False
    if streamed:
        answer = "".join(chunks).strip()
    else:
        result = response_llm.invoke(prompt_messages)
        answer = (
            getattr(result, "content", None)
            or getattr(result, "text", "")
            or str(result)
        ).strip()
    trace["generation_ms"] = round((time.perf_counter() - synthesis_start) * 1000, 3)
    trace["ttft_ms"] = (
        round(handler.ttft_ms, 3) if handler.ttft_ms is not None else None
    )

    trace["query_ms"] = round((time.perf_counter() - total_start) * 1000, 3)

    return {
        "answer": answer,
        "condensed_question": standalone,
        "final_docs": final_docs,
        "score_map": score_map,
        "trace": trace,
    }