"""Service orchestration: chatbot (chain + memory + answer).

Wires the retriever, LLMs, memory and chain from the registry, then answers
questions with source documents. Provider default models mirror
``RAG_app.py`` sidebars.
"""

DEFAULT_MODELS = {
    "openai": "gpt-4-turbo-preview",
    "google": "gemini-2.5-flash",
    "huggingface": "mistralai/Mistral-7B-Instruct-v0.2",
}


def default_model(provider: str) -> str:
    """Return the default model name for a provider."""
    return DEFAULT_MODELS.get(provider, "")


def build_chat_engine(
    retriever,
    llm_provider: str = "google",
    model: str = "",
    language: str = "english",
    memory_name: str = "buffer",
    api_keys: dict | None = None,
    temperature: float = 0.5,
    top_p: float = 0.95,
):
    """Assemble chain + memory for a chat session.

    Returns a dict with ``chain`` and ``memory``.
    """
    api_keys = api_keys or {}
    model = model or default_model(llm_provider)

    condense_llm, response_llm = _build_llms(
        provider=llm_provider,
        api_key=api_keys.get(llm_provider, ""),
        model=model,
        temperature=temperature,
        top_p=top_p,
    )

    from rag.chains import get_chain
    from rag.memory import get_memory
    from rag.prompts import get_prompt

    if memory_name == "summary":
        memory = get_memory(memory_name)(llm=condense_llm)
    else:
        memory = get_memory(memory_name)()
    chain = get_chain("conversational")(
        retriever=retriever,
        standalone_query_generation_llm=condense_llm,
        response_generation_llm=response_llm,
        memory=memory,
        answer_prompt=get_prompt("answer")(language=language),
        condense_question_prompt=get_prompt("condense")(),
    )
    return {"chain": chain, "memory": memory}


def _build_llms(provider: str, api_key: str, model: str, temperature: float, top_p: float):
    """Instantiate the condense + response LLMs for a provider.

    Streaming is enabled on chat models so the execution pipeline can measure
    time-to-first-token via a callback.
    """
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        condense = ChatOpenAI(
            api_key=api_key,
            model=model,
            temperature=0.1,
            streaming=True,
        )
        response = ChatOpenAI(
            api_key=api_key,
            model=model,
            temperature=temperature,
            model_kwargs={"top_p": top_p},
            streaming=True,
        )
        return condense, response

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        base = {
            "google_api_key": api_key,
            "model": model,
            "convert_system_message_to_human": True,
            "streaming": True,
        }
        condense = ChatGoogleGenerativeAI(**base, temperature=0.1)
        response = ChatGoogleGenerativeAI(
            **base, temperature=temperature, top_p=top_p
        )
        return condense, response

    if provider == "huggingface":
        from langchain_community.llms import HuggingFaceHub

        condense = HuggingFaceHub(
            repo_id=model,
            huggingfacehub_api_token=api_key,
            model_kwargs={
                "temperature": 0.1,
                "top_p": 0.95,
                "do_sample": True,
                "max_new_tokens": 1024,
            },
        )
        response = HuggingFaceHub(
            repo_id=model,
            huggingfacehub_api_token=api_key,
            model_kwargs={
                "temperature": temperature,
                "top_p": top_p,
                "do_sample": True,
                "max_new_tokens": 1024,
            },
        )
        return condense, response

    raise NotImplementedError(f"LLM provider '{provider}' not yet supported.")