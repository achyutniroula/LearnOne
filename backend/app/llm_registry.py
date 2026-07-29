from dataclasses import dataclass
from typing import Literal

# Embedding — local, in-process via fastembed (ONNXRuntime). No external API,
# no rate limit. bge-small-en-v1.5 produces 384-dim vectors.
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384

# RAG retrieval
RAG_TOP_K = 5
EXPLAINER_TOP_K = 12

# Cooldown Redis key prefix (follows learnone:* namespace)
COOLDOWN_KEY_PREFIX = "learnone:thinker:cooldown"


@dataclass(frozen=True)
class ModelConfig:
    provider: Literal["gemini", "groq"]
    model_id: str
    default_cooldown_secs: int = 60


# Generation model for analyst + scriptwriter (single-turn, no live streaming)
GENERATION_MODEL = "gemini-2.5-flash"
GENERATION_MAX_TOKENS = 8192
ANALYST_CHUNK_LIMIT = 150

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
