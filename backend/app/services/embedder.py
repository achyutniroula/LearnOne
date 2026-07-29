"""
Local, in-process embedding via fastembed (ONNXRuntime) — no external API call,
no rate limit. Model is loaded once per process (module-level singleton).
"""
import logging
import threading

from ..llm_registry import EMBEDDING_MODEL

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from fastembed import TextEmbedding
                logging.info(f"Embedder: loading {EMBEDDING_MODEL}...")
                _model = TextEmbedding(model_name=EMBEDDING_MODEL)
                logging.info("Embedder: model loaded")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    return [vec.tolist() for vec in model.embed(texts)]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
