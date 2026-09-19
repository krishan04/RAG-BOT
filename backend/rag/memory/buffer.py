"""Conversation buffer memory.

Lifted from ``RAG_app.py::create_memory`` (non-gpt-3.5 branch).
"""


def create_buffer_memory():
    """Return a ``ConversationBufferMemory`` configured for a retrieval chain."""
    from langchain.memory import ConversationBufferMemory

    return ConversationBufferMemory(
        return_messages=True,
        memory_key="chat_history",
        output_key="answer",
        input_key="question",
    )