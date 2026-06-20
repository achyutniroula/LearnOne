from dataclasses import dataclass
from typing import Literal

# Live API — use stable model; newer preview available (gemini-3.1-flash-live-preview)
# but preview models can be deprecated with only ~2 weeks notice.
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# Gemini Live voice — Aoede is warm and natural; alternatives: Puck, Charon, Kore, Fenrir, Zephyr
LIVE_VOICE_NAME = "Aoede"

# Embedding — gemini-embedding-001 produces 768-dim vectors
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768

# RAG retrieval
RAG_TOP_K = 5

# Cooldown Redis key prefix (follows learnone:* namespace)
COOLDOWN_KEY_PREFIX = "learnone:thinker:cooldown"


@dataclass(frozen=True)
class ModelConfig:
    provider: Literal["gemini", "groq"]
    model_id: str
    default_cooldown_secs: int = 60


# Ordered fallback chain: primary first, cheapest/fastest last resort last.
# Groq model IDs could not be verified from docs scrape (JS-rendered page).
# Verify they are still active: GET https://api.groq.com/openai/v1/models
THINKER_CHAIN: list[ModelConfig] = [
    ModelConfig("gemini", "gemini-2.5-flash", 60),
    ModelConfig("gemini", "gemini-2.5-flash-lite", 60),
    ModelConfig("gemini", "gemini-3.1-flash-lite", 60),
    ModelConfig("groq", "llama-3.3-70b-versatile", 60),
    ModelConfig("groq", "llama-3.1-8b-instant", 30),
]
