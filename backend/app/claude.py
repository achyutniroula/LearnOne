from groq import Groq
from .config import settings

_client: Groq | None = None

MODEL      = "llama-3.3-70b-versatile"   # high quality, 100K TPD free tier
MODEL_FAST = "llama-3.1-8b-instant"      # large context, ~500K TPD free tier


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def run_claude(prompt: str, **_) -> str:
    """Single-turn completion — used for curriculum, quiz, summary, diagram generation."""
    resp = _get_client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        temperature=0.7,
    )
    return resp.choices[0].message.content or ""


def chat_with_history(messages: list[dict], system: str, model: str | None = None) -> str:
    """Multi-turn chat — messages are already [{"role": "user"|"assistant", "content": "..."}]."""
    resp = _get_client().chat.completions.create(
        model=model or MODEL,
        messages=[{"role": "system", "content": system}] + messages,
        max_tokens=2048,
        temperature=0.7,
    )
    return resp.choices[0].message.content or ""


def build_messages_prompt(history: list[dict], system_prompt: str) -> str:
    """Kept for backward compatibility — not used for chat anymore."""
    return system_prompt
