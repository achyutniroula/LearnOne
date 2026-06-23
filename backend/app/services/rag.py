import logging
from google import genai
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..config import settings
from ..llm_registry import EMBEDDING_MODEL, RAG_TOP_K

_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.gemini_api_key or None)
    return _gemini_client


def embed_text(text_to_embed: str) -> list[float]:
    """Embed a string using the Gemini embedding model. Returns a float list."""
    from google.genai import types as gtypes
    from ..llm_registry import EMBEDDING_DIM
    client = _get_gemini_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text_to_embed,
        config=gtypes.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    return result.embeddings[0].values


def retrieve_context(query: str, db: Session, top_k: int = RAG_TOP_K) -> str:
    """Embed query and retrieve top-k similar repo chunks via pgvector cosine search."""
    try:
        embedding = embed_text(query)
    except Exception as e:
        logging.error(f"RAG embed_text failed: {e}")
        return ""

    vec_literal = "[" + ",".join(str(v) for v in embedding) + "]"

    try:
        rows = db.execute(
            text("""
                SELECT file_path, content
                FROM repo_chunks
                ORDER BY embedding <=> CAST(:vec AS vector)
                LIMIT :k
            """),
            {"vec": vec_literal, "k": top_k},
        ).fetchall()
    except Exception as e:
        logging.error(f"RAG vector search failed: {e}")
        return ""

    if not rows:
        return ""

    return "\n\n".join(f"### {row.file_path}\n{row.content}" for row in rows)
