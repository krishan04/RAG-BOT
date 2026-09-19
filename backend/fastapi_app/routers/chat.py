"""Chat endpoints: explicit stage-timed RAG pipeline -> answer + execution trace."""

import hashlib

from django.conf import settings
from fastapi import APIRouter, HTTPException

from fastapi_app.schemas import ChatRequest, ChatResponse

router = APIRouter()


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars/token), surfaced in the trace UI."""
    return max(1, round(len(text) / 4))


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    """Answer a question against a vectorstore, persisting conversation + trace."""
    from core.models import ChatSession, Message, VectorStore
    from rag.embeddings import get_embeddings_factory
    from rag.memory import get_memory
    from rag.prompts import get_prompt
    from rag.services.chatbot import _build_llms
    from rag.services.execution import execute_pipeline
    from rag.services.retrieval import build_retriever
    from rag.vectorstores.chroma import load_chroma_vectorstore

    store = VectorStore.objects.filter(name=payload.vector_store).first()
    if store is None:
        raise HTTPException(status_code=404, detail=f"Vectorstore '{payload.vector_store}' not found.")

    api_keys = settings.API_KEYS
    embeddings = get_embeddings_factory(payload.llm_provider)(
        api_key=api_keys.get(payload.llm_provider, "")
    )

    persist_directory = store.persist_path or str(settings.VECTOR_STORE_ROOT / store.name)
    vectorstore = load_chroma_vectorstore(embeddings, persist_directory)

    retriever_info = build_retriever(
        vectorstore=vectorstore,
        embeddings=embeddings,
        retriever_name=payload.retriever.value,
        api_keys=api_keys,
    )

    condense_llm, response_llm = _build_llms(
        provider=payload.llm_provider,
        api_key=api_keys.get(payload.llm_provider, ""),
        model=payload.model,
        temperature=payload.temperature,
        top_p=payload.top_p,
    )

    if payload.memory == "summary":
        memory = get_memory("summary")(llm=condense_llm)
    else:
        memory = get_memory("buffer")()

    session = ChatSession.objects.create(
        vector_store=store,
        llm_provider=payload.llm_provider,
        model=payload.model,
        retriever_type=payload.retriever.value,
        language=payload.language,
    )
    Message.objects.create(
        session=session, role=Message.Role.USER, content=payload.question
    )

    chat_history = memory.load_memory_variables({}).get("chat_history") or []

    result = execute_pipeline(
        vectorstore=vectorstore,
        compressor=retriever_info["compressor"],
        condense_llm=condense_llm,
        response_llm=response_llm,
        question=payload.question,
        chat_history=chat_history,
        answer_prompt=get_prompt("answer")(language=payload.language),
        condense_question_prompt=get_prompt("condense")(),
        k=16,
    )

    answer = result["answer"]
    if payload.llm_provider == "huggingface":
        marker = "\nAnswer: "
        idx = answer.find(marker)
        if idx != -1:
            answer = answer[idx + len(marker):]

    memory.save_context({"question": payload.question}, {"answer": answer})

    token_estimate = _estimate_tokens(answer)
    sources = []
    for idx, doc in enumerate(result["final_docs"]):
        content = doc.page_content
        score = result["score_map"].get(content)
        token_estimate += _estimate_tokens(content)
        sources.append(
            {
                "source": doc.metadata.get("source"),
                "page": doc.metadata.get("page"),
                "content": content,
                "score": round(score, 6) if score is not None else None,
                "chunk_hash": hashlib.md5(content.encode("utf-8")).hexdigest()[:12],
                "chunk_index": idx,
                "tokens": _estimate_tokens(content),
                "retrieval_ms": result["trace"]["retrieval_ms"],
            }
        )

    file_types = list(
        store.documents.exclude(file_type="")
        .values_list("file_type", flat=True)
        .distinct()
    )
    trace = {
        **result["trace"],
        "condensed_question": result["condensed_question"],
        "token_estimate": token_estimate,
        "chunk_size": store.chunk_size,
        "chunk_overlap": store.chunk_overlap,
        "language": payload.language,
        "file_types": file_types,
        "retriever": payload.retriever,
        "sources": sources,
    }

    Message.objects.create(
        session=session,
        role=Message.Role.ASSISTANT,
        content=answer,
        sources_json=sources,
        trace_json=trace,
    )

    return ChatResponse(
        answer=answer,
        source_documents=sources,
        query_ms=trace["query_ms"],
        retrieval_ms=trace["retrieval_ms"],
        rerank_ms=trace.get("rerank_ms", 0.0) or 0.0,
        ttft_ms=trace.get("ttft_ms"),
        token_estimate=token_estimate,
        trace=trace,
    )