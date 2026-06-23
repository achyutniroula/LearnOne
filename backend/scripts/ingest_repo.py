"""
One-time script to ingest the LearnOne repo into pgvector for RAG.

Usage:
    python scripts/ingest_repo.py [--repo-root PATH] [--dry-run] [--verbose]

Run from backend/ directory with the virtualenv activated.
Deletes and re-ingests on every run (clean-slate approach).
"""
import argparse
import logging
import os
import sys
import time
from pathlib import Path

# Ensure we can import from the parent package
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from google import genai
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.llm_registry import EMBEDDING_MODEL

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# File extension sets
# ---------------------------------------------------------------------------
PYTHON_EXTS = {".py"}
TS_EXTS = {".ts", ".tsx", ".js", ".jsx"}
DOC_EXTS = {".md", ".rst", ".txt"}
SKIP_DIRS = {
    "__pycache__", "node_modules", ".git", ".venv", "venv", "env",
    "dist", "build", ".next", "coverage", ".pytest_cache", "migrations",
    ".claude", "worktrees", "agent-memory", "docs", "Documentation",
}
SKIP_FILES = {"package-lock.json", "yarn.lock", "poetry.lock"}
MAX_FILE_BYTES = 200_000  # skip very large files (>200KB)


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

def _split_by_boundaries(text: str, boundaries: list[str], max_chars: int) -> list[str]:
    """Split text on function/class boundaries, then hard-split oversized chunks."""
    import re
    pattern = "(" + "|".join(re.escape(b) for b in boundaries) + ")"
    parts = re.split(pattern, text)
    chunks: list[str] = []
    current = ""
    for part in parts:
        candidate = current + part
        if len(candidate) > max_chars and current:
            chunks.append(current.strip())
            current = part
        else:
            current = candidate
    if current.strip():
        chunks.append(current.strip())
    # Hard-split any chunk that's still too long
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
        else:
            for i in range(0, len(chunk), max_chars):
                result.append(chunk[i:i + max_chars].strip())
    return [c for c in result if c]


def chunk_python(text: str) -> list[str]:
    return _split_by_boundaries(text, ["\ndef ", "\nclass "], max_chars=2000)


def chunk_typescript(text: str) -> list[str]:
    return _split_by_boundaries(text, ["\nexport ", "\nfunction ", "\nconst "], max_chars=2000)


def chunk_sliding_window(text: str, size: int, overlap: int) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start += size - overlap
    return [c for c in chunks if c]


def chunk_file(path: Path, text: str) -> list[str]:
    ext = path.suffix.lower()
    if ext in PYTHON_EXTS:
        return chunk_python(text)
    if ext in TS_EXTS:
        return chunk_typescript(text)
    if ext in DOC_EXTS:
        return chunk_sliding_window(text, size=1000, overlap=200)
    return chunk_sliding_window(text, size=1500, overlap=300)


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

_gemini_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def embed_text(text: str) -> list[float]:
    """Embed text using gemini-embedding-001 (768-dim). Retries once on 429."""
    from google.genai import types as gtypes
    client = _get_client()
    for attempt in range(2):
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config=gtypes.EmbedContentConfig(output_dimensionality=768),
            )
            return result.embeddings[0].values
        except Exception as e:
            msg = str(e)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                wait = 30
                log.warning(f"Rate limited on embed, sleeping {wait}s (attempt {attempt + 1})")
                time.sleep(wait)
                if attempt == 1:
                    raise
            else:
                raise


# ---------------------------------------------------------------------------
# Ingest logic
# ---------------------------------------------------------------------------

def collect_files(repo_root: Path) -> list[Path]:
    all_exts = PYTHON_EXTS | TS_EXTS | DOC_EXTS | {".json", ".yaml", ".yml", ".toml", ".sql"}
    files: list[Path] = []
    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.suffix.lower() not in all_exts:
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            continue
        files.append(path)
    return sorted(files)


SELF_REPO_URL = "local://learnone-self"


def _get_or_create_self_repo(db: Session) -> int:
    """
    Ensure an indexed_repos row exists for the LearnOne self-repo.
    Returns the repo_id to use when inserting repo_chunks.
    """
    from sqlalchemy import text as sqla_text
    row = db.execute(
        sqla_text("SELECT id FROM indexed_repos WHERE repo_url = :url"),
        {"url": SELF_REPO_URL},
    ).fetchone()
    if row:
        return row.id
    result = db.execute(
        sqla_text(
            "INSERT INTO indexed_repos (repo_url, owner, repo_name, default_branch, status) "
            "VALUES (:url, 'local', 'learnone-self', 'main', 'ready') RETURNING id"
        ),
        {"url": SELF_REPO_URL},
    )
    db.commit()
    return result.fetchone().id


def ingest(repo_root: Path, dry_run: bool, verbose: bool) -> None:
    from sqlalchemy import text

    files = collect_files(repo_root)
    log.info(f"Found {len(files)} files under {repo_root}")

    if dry_run:
        for f in files:
            rel = f.relative_to(repo_root)
            chunks = chunk_file(f, f.read_text(errors="replace"))
            log.info(f"  {rel}: {len(chunks)} chunks")
        log.info("Dry run complete — no DB writes.")
        return

    db: Session = SessionLocal()
    try:
        repo_id = _get_or_create_self_repo(db)
        log.info(f"Using indexed_repos.id={repo_id} for LearnOne self-repo")

        # Clean slate for this repo_id only
        deleted = db.execute(
            text("DELETE FROM repo_chunks WHERE repo_id = :rid"), {"rid": repo_id}
        ).rowcount
        db.commit()
        log.info(f"Deleted {deleted} existing rows from repo_chunks for repo_id={repo_id}")

        total_chunks = 0
        batch: list[dict] = []

        for file_path in files:
            rel = str(file_path.relative_to(repo_root)).replace("\\", "/")
            try:
                text_content = file_path.read_text(errors="replace")
            except Exception as e:
                log.warning(f"Cannot read {rel}: {e}")
                continue

            chunks = chunk_file(file_path, text_content)
            if verbose:
                log.info(f"  {rel}: {len(chunks)} chunks")

            for idx, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue

                try:
                    embedding = embed_text(chunk)
                    time.sleep(0.5)  # gentle rate limiting
                except Exception as e:
                    log.error(f"Failed to embed {rel}[{idx}]: {e}")
                    continue

                vec_literal = "[" + ",".join(str(v) for v in embedding) + "]"
                batch.append({
                    "repo_id": repo_id,
                    "file_path": rel,
                    "chunk_index": idx,
                    "content": chunk,
                    "embedding": vec_literal,
                })

                if len(batch) >= 50:
                    _flush_batch(db, batch)
                    total_chunks += len(batch)
                    batch = []
                    log.info(f"  Committed {total_chunks} chunks so far...")

        if batch:
            _flush_batch(db, batch)
            total_chunks += len(batch)

        # Update chunk_count on the indexed_repos row
        db.execute(
            text("UPDATE indexed_repos SET chunk_count = :n WHERE id = :rid"),
            {"n": total_chunks, "rid": repo_id},
        )
        db.commit()

        log.info(f"Ingestion complete. {total_chunks} chunks written to repo_chunks (repo_id={repo_id}).")
    finally:
        db.close()


def _flush_batch(db: Session, batch: list[dict]) -> None:
    from sqlalchemy import text
    # Execute one row at a time — psycopg2 executemany mangles ::vector cast syntax
    stmt = text(
        "INSERT INTO repo_chunks (repo_id, file_path, chunk_index, content, embedding) "
        "VALUES (:repo_id, :file_path, :chunk_index, :content, CAST(:embedding AS vector))"
    )
    for row in batch:
        db.execute(stmt, row)
    db.commit()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest LearnOne repo into pgvector")
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).parent.parent.parent),
        help="Root of the repository (default: project root)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Count chunks without writing to DB")
    parser.add_argument("--verbose", action="store_true", help="Log each file being processed")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    if not repo_root.is_dir():
        log.error(f"repo-root does not exist: {repo_root}")
        sys.exit(1)

    log.info(f"Repo root: {repo_root}")
    log.info(f"Embedding model: {EMBEDDING_MODEL}")
    ingest(repo_root, dry_run=args.dry_run, verbose=args.verbose)


if __name__ == "__main__":
    main()
