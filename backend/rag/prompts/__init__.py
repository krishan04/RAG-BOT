"""Prompts component. Registry: ``get_prompt(name)`` / ``list_prompts()``.

Each module defines a ``PromptFactory`` callable that returns a LangChain
prompt (``PromptTemplate`` / ``ChatPromptTemplate``).
"""

from rag.prompts import answer, condense

_REGISTRY = {
    "answer": answer.create_answer_prompt,
    "condense": condense.create_condense_question_prompt,
}


def get_prompt(name: str):
    factory = _REGISTRY.get(name)
    if factory is None:
        raise KeyError(f"Unknown prompt '{name}'. Available: {list_prompts()}")
    return factory


def list_prompts() -> list[str]:
    return list(_REGISTRY.keys())