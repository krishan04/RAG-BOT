"""Conversation summary buffer memory.

Lifted from ``RAG_app.py::create_memory`` (gpt-3.5 branch).
"""


def create_summary_memory(
    llm,
    max_token_limit: int = 1024,  # max_tokens for 'gpt-3.5-turbo' = 4096
):
    """Return a ``ConversationSummaryBufferMemory`` that summarizes older turns."""
    from langchain.memory import ConversationSummaryBufferMemory

    return ConversationSummaryBufferMemory(
        max_token_limit=max_token_limit,
        llm=llm,
        return_messages=True,
        memory_key="chat_history",
        output_key="answer",
        input_key="question",
    )