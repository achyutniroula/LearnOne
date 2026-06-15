import asyncio
import logging
import re

from google import genai
from google.genai import types as genai_types
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..llm_registry import THINKER_CHAIN, COOLDOWN_KEY_PREFIX, ModelConfig
from .rag import retrieve_context

_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.gemini_api_key or None)
    return _gemini_client


def _get_redis():
    from ..redis_client import get_redis
    return get_redis()


def _is_in_cooldown(model_id: str) -> bool:
    try:
        return bool(_get_redis().exists(f"{COOLDOWN_KEY_PREFIX}:{model_id}"))
    except Exception:
        return False


def _set_cooldown(model_id: str, secs: int) -> None:
    try:
        _get_redis().setex(f"{COOLDOWN_KEY_PREFIX}:{model_id}", secs, "1")
    except Exception:
        pass


def _parse_retry_delay(error_str: str, default: int) -> int:
    """Extract retryDelay seconds from a Gemini/Groq 429 error string."""
    m = re.search(r'"retryDelay"\s*:\s*"(\d+)s"', error_str)
    if m:
        return int(m.group(1)) + 5
    m = re.search(r'retry[_ ]?after[^\d]*(\d+)', error_str, re.IGNORECASE)
    if m:
        return int(m.group(1)) + 5
    return default


def _call_gemini(model_id: str, messages: list[dict], system: str) -> str:
    contents = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append(
            genai_types.Content(
                role=role,
                parts=[genai_types.Part.from_text(text=msg["content"])],
            )
        )
    config = genai_types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=2048,
        temperature=0.7,
    )
    resp = _get_gemini_client().models.generate_content(
        model=model_id,
        contents=contents,
        config=config,
    )
    return resp.text or ""


def _call_groq(model_id: str, messages: list[dict], system: str) -> str:
    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)
    groq_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]} for m in messages
    ]
    resp = client.chat.completions.create(
        model=model_id,
        messages=groq_messages,
        max_tokens=2048,
    )
    return resp.choices[0].message.content or ""


def _consult_thinker_sync(query: str, system: str) -> str:
    """
    Sync: retrieve RAG context, then try each model in THINKER_CHAIN.
    Sets Redis cooldown keys on 429. Returns friendly string if all fail.
    """
    local_db = SessionLocal()
    try:
        rag_context = retrieve_context(query, local_db)
    finally:
        local_db.close()

    if rag_context:
        full_query = f"Context from the LearnOne codebase:\n{rag_context}\n\nQuestion: {query}"
    else:
        full_query = query

    for mc in THINKER_CHAIN:
        if _is_in_cooldown(mc.model_id):
            logging.debug(f"Thinker: {mc.model_id} is in cooldown, skipping")
            continue
        try:
            messages = [{"role": "user", "content": full_query}]
            if mc.provider == "gemini":
                return _call_gemini(mc.model_id, messages, system)
            else:
                return _call_groq(mc.model_id, messages, system)
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err or "rate_limit" in err.lower():
                delay = _parse_retry_delay(err, mc.default_cooldown_secs)
                _set_cooldown(mc.model_id, delay)
                logging.warning(f"Thinker: {mc.model_id} rate-limited, cooldown {delay}s")
                continue
            logging.error(f"Thinker: {mc.model_id} error: {e}")
            continue

    return "I'm having trouble thinking right now — give me a moment and try again."


async def consult_thinker(query: str, system: str) -> str:
    """Async entry point — wraps sync work in a thread executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _consult_thinker_sync, query, system)
