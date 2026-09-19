"""ConversationalRetrievalChain with memory.

Lifted from ``RAG_app.py::create_ConversationalRetrievalChain``.
"""


def create_conversational_chain(
    retriever,
    standalone_query_generation_llm,
    response_generation_llm,
    memory,
    answer_prompt,
    condense_question_prompt,
    chain_type: str = "stuff",
):
    """Build a LangChain ``ConversationalRetrievalChain``.

    Rephrases follow-up questions into a standalone query (condense LLM),
    retrieves context, then answers using the response LLM with memory.
    """
    from langchain.chains import ConversationalRetrievalChain

    return ConversationalRetrievalChain.from_llm(
        condense_question_prompt=condense_question_prompt,
        combine_docs_chain_kwargs={"prompt": answer_prompt},
        condense_question_llm=standalone_query_generation_llm,
        llm=response_generation_llm,
        memory=memory,
        retriever=retriever,
        chain_type=chain_type,
        verbose=False,
        return_source_documents=True,
    )