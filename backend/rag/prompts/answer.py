"""Answer prompt: standalone question + chat history + context -> final answer.

Lifted from ``RAG_app.py::answer_template``.
"""


def answer_template(language: str = "english") -> str:
    """Return the answer prompt template for the given assistant language."""
    template = f"""Answer the question at the end, using only the following context (delimited by <context></context>).
Your answer must be in the language at the end. 

<context>
{{chat_history}}

{{context}} 
</context>

Question: {{question}}

Language: {language}.
"""
    return template


def create_answer_prompt(language: str = "english"):
    """Build a ``ChatPromptTemplate`` from the answer template."""
    from langchain.prompts import ChatPromptTemplate

    return ChatPromptTemplate.from_template(answer_template(language=language))