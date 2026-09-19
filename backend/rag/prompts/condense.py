"""Condense-question prompt: chat history + follow-up -> standalone question.

Lifted from ``RAG_app.py::create_ConversationalRetrievalChain``.
"""


def create_condense_question_prompt():
    """Return a ``PromptTemplate`` that rephrases a follow-up into a standalone question."""
    from langchain.prompts import PromptTemplate

    return PromptTemplate(
        input_variables=["chat_history", "question"],
        template="""Given the following conversation and a follow up question, 
rephrase the follow up question to be a standalone question, in its original language.\n\n
Chat History:\n{chat_history}\n
Follow Up Input: {question}\n
Standalone question:""",
    )