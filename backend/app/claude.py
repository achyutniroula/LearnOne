from google import genai
from google.genai import types
from .config import settings

_client: genai.Client | None = None

MODEL      = "gemini-2.5-flash"
MODEL_FAST = "gemini-2.5-flash"


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = settings.gemini_api_key or None
        _client = genai.Client(api_key=api_key)
    return _client


def run_claude(prompt: str, **_) -> str:
    """Single-turn completion — used for curriculum, quiz, summary, diagram generation."""
    resp = _get_client().models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=2048,
            temperature=0.7,
        )
    )
    return resp.text or ""


def chat_with_history(messages: list[dict], system: str, model: str | None = None) -> str:
    """Multi-turn chat — messages are already [{"role": "user"|"assistant", "content": "..."}]."""
    contents = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=m["content"])]
            )
        )

    config = types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=2048,
        temperature=0.7,
    )

    resp = _get_client().models.generate_content(
        model=model or MODEL,
        contents=contents,
        config=config
    )
    return resp.text or ""


def transcribe_audio(data: bytes, mime_type: str) -> str:
    """Transcribe audio bytes using Gemini."""
    resp = _get_client().models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(
                data=data,
                mime_type=mime_type,
            ),
            "Provide a clean transcription of this audio. Output only the transcribed text, with no extra conversational fillers, prefix, introduction, explanation, or formatting."
        ]
    )
    return (resp.text or "").strip()


def build_messages_prompt(history: list[dict], system_prompt: str) -> str:
    """Kept for backward compatibility — not used for chat anymore."""
    return system_prompt

