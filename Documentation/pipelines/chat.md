# Pipeline: Chat — `POST /api/chat`

> The main feature. Everything below is file → function → what it does.

## Frontend

```text
frontend/src/components/chat/ChatCanvas.tsx
 └── handleSend()                      # user clicks send
      ├── guards: no input / no store / busy
      ├── setMessages([... prev, user message])
      └── sendChat({vector_store: store.name, question,
                    llm_provider, model, retriever, memory})
            │
frontend/src/api/client.ts: sendChat()
            │  fetch('/api/chat', {POST JSON})  → Vite proxy → http://127.0.0.1:8000
            ▼
```

## Wire protocol

```json
POST /api/chat
{ "vector_store": "CV", "question": "…", "llm_provider": "google",
  "model": "", "retriever": "base", "memory": "buffer",
  "language": "english", "temperature": 0.5, "top_p": 0.95 }
```

## Backend handler

```text
backend/fastapi_app/routers/chat.py :: chat(payload: ChatRequest)
 1. 404 if VectorStore.objects.filter(name=…).first() is None
 2. embeddings = rag.embeddings.get_embeddings_factory(llm_provider)(api_key)
 3. vectorstore = rag.vectorstores.chroma.load_chroma_vectorstore(embeddings, persist_directory)
      persist_directory = store.persist_path or data/vector_stores/<name>
 4. retriever_info = rag.services.retrieval.build_retriever(...)
      → get_retriever_factory(name) → base | cohere_rerank | contextual_compression
 5. (condense_llm, response_llm) = rag.services.chatbot._build_llms(provider, api_key, model, temp, top_p)
 6. memory = rag.memory.get_memory("summary")(llm=condense_llm)  if memory=="summary"
             else rag.memory.get_memory("buffer")()
 7. ChatSession.objects.create(vector_store, llm_provider, model, retriever_type, language)
    Message.objects.create(role=USER, content=question)
 8. chat_history = memory.load_memory_variables({}).get("chat_history") or []   # always [] fresh
 9. result = rag.services.execution.execute_pipeline(
       vectorstore, compressor=retriever_info["compressor"],
       condense_llm, response_llm, question, chat_history,
       answer_prompt=rag.prompts.get_prompt("answer")(language),
       condense_question_prompt=rag.prompts.get_prompt("condense")(), k=16)
 10. HF cleanup: strip "\nAnswer: "
 11. memory.save_context({question}, {answer})
 12. token_estimate = _estimate_tokens(answer); build sources[] from result["final_docs"]
      + result["score_map"] + hashlib.md5(content).hexdigest()[:12] as chunk_hash
 13. trace = {**result["trace"], condensed_question, token_estimate, chunk_size,
      chunk_overlap, language, file_types, retriever, sources}
 14. Message.objects.create(role=ASSISTANT, content=answer,
      sources_json=sources, trace_json=trace)
 15. return ChatResponse(...)
```

## The execution pipeline (stage by stage)

```text
backend/rag/services/execution.py :: execute_pipeline(**kwargs)
                [all keyword-only]

Stage 1 — Condense question                          trace["condense_ms"]
  chat_history empty? → standalone = question
  else LLMChain(llm=condense_llm, prompt=condense.prompt).invoke(...)

Stage 2 — Vector search                              trace["k_retrieved"], ["score_bounds"]
  scored = vectorstore.similarity_search_with_score(standalone, k=16)
  docs, scores = …, score_map = {page_content: score}

Stage 3 — Rerank / compress                          trace["rerank_ms"], ["k_filtered"]
  final_docs = rag.services.retrieval.rerank_documents(compressor, docs, standalone)
  (compressor None for "base" → docs unchanged)

Stage 4 — Synthesize answer                          trace["generation_ms"], ["ttft_ms"], ["query_ms"]
  prompt_messages = answer_prompt.format_prompt(question=standalone,
                      chat_history=chat_history, context="\n\n".join(contents)).to_messages()
  handler = FirstTokenCallbackHandler()                      # TTFT
  response_llm.stream(prompt_messages, config={"callbacks":[handler]})
    fallback: response_llm.invoke(...)
```

## External calls made

| Call | Provider | Built by |
| ---- | -------- | -------- |
| Embeddings (only to *build* the store path; actually used via vectorstore) | provider-specific | `rag/embeddings/<provider>.py` |
| Vector similarity search | local Chroma | `langchain_community.vectorstores.Chroma.similarity_search_with_score` |
| Rerank (only for `cohere_rerank` / `contextual_compression` retrievers) | Cohere / local embeddings | `rag/retrievers/*.py` |
| LLM stream (condense + answer) | OpenAI / Gemini / HuggingFace | `rag/services/chatbot.py::_build_llms` |

## Persistence

```text
SQLite (backend/db.sqlite3)
 ├── core_chatsession  ← new row
 └── core_message      ← 2 rows (user + assistant) with sources_json + trace_json
```

## Response → UI

```text
ChatResponse → fetch → ChatCanvas.setState(messages) 
  → MessageBubble renders answer (react-markdown)
  → SourceBadge (per source) → click → TraceContext.focus(source, trace)
  → PipelineTrace panel reads TraceContext.trace → renders 4-stage timings
```

## Errors

- Store missing → HTTP 404 `{"detail": "Vectorstore '<name>' not found."}`
- Provider/API failures → HTTP 500 (uncaught), no custom handling.
- Bad enum → HTTP 422 (Pydantic).

## Key files

| Role | File |
| ---- | ---- |
| UI handler | `frontend/src/components/chat/ChatCanvas.tsx` |
| API client | `frontend/src/api/client.ts` |
| Router | `backend/fastapi_app/routers/chat.py` |
| Schema | `backend/fastapi_app/schemas.py` (`ChatRequest`, `ChatResponse`) |
| Pipeline | `backend/rag/services/execution.py` |
| Retriever assembly | `backend/rag/services/retrieval.py` |
| LLMs | `backend/rag/services/chatbot.py` |
| Persistence | `backend/core/models.py` |