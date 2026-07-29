import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..llm_registry import RAG_TOP_K
from .embedder import embed_text


def retrieve_context(
    query: str,
    db: Session,
    top_k: int = RAG_TOP_K,
    repo_id: int | None = None,
) -> str:
    """
    Embed query and retrieve top-k similar repo chunks via pgvector cosine search.

    If repo_id is provided, results are filtered to that repo only.
    If repo_id is None, all chunks are searched (used for the self-RAG thinker path).
    """
    try:
        embedding = embed_text(query)
    except Exception as e:
        logging.error(f"RAG embed_text failed: {e}")
        return ""

    vec_literal = "[" + ",".join(str(v) for v in embedding) + "]"

    try:
        if repo_id is not None:
            rows = db.execute(
                text("""
                    SELECT file_path, content
                    FROM repo_chunks
                    WHERE repo_id = :repo_id
                    ORDER BY embedding <=> CAST(:vec AS vector)
                    LIMIT :k
                """),
                {"vec": vec_literal, "k": top_k, "repo_id": repo_id},
            ).fetchall()
        else:
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
