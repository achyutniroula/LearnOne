"""
Repo fetch → chunk → embed → store pipeline.

Called in a daemon thread via threading.Thread (matching existing project patterns).
Use asyncio.run() inside the thread for the async HTTP fetch phase; DB and embedding
calls are synchronous.
"""

import asyncio
import logging
import os
import re
import shutil
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

import httpx

from ..config import settings
from ..database import SessionLocal
from ..llm_registry import EMBEDDING_MODEL, EMBEDDING_DIM

GITHUB_API = "https://api.github.com"
MAX_REPO_MB = 500
CLONE_THRESHOLD_MB = 100
MAX_FILE_BYTES = 200_000        # 200 KB per file
MAX_FILES_AFTER_FILTER = 1000   # large-repo cutoff
CHUNK_BATCH_SIZE = 20
RATE_LIMIT_PAUSE_SECS = 60

# Chunking token targets (1 token ≈ 4 chars)
SOURCE_MAX_CHARS = 1_600    # ~400 tokens
MARKDOWN_MAX_CHARS = 1_200  # ~300 tokens
CONFIG_MAX_CHARS = 1_600    # ~400 tokens
OVERLAP_CHARS = 200         # ~50 tokens

# ── File classification sets ──────────────────────────────────────────────────

_MD_EXTS = {'.md', '.mdx', '.rst', '.txt', '.adoc', '.org'}
_CONFIG_EXTS = {
    '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.conf', '.config', '.env', '.properties', '.xml', '.xsd',
}
_CONFIG_NAMES = {'dockerfile', 'makefile', 'procfile', 'justfile', 'caddyfile'}

# Declaration-boundary patterns per extension for source code chunking
_SRC_BOUNDARIES: dict[str, list[str]] = {
    '.py':   ['\ndef ', '\nclass ', '\nasync def '],
    '.ts':   ['\nexport ', '\nfunction ', '\nconst ', '\nclass '],
    '.tsx':  ['\nexport ', '\nfunction ', '\nconst ', '\nclass '],
    '.js':   ['\nexport ', '\nfunction ', '\nconst ', '\nclass '],
    '.jsx':  ['\nexport ', '\nfunction ', '\nconst ', '\nclass '],
    '.go':   ['\nfunc ', '\ntype ', '\nvar ', '\nconst '],
    '.rs':   ['\npub fn ', '\nfn ', '\npub struct ', '\nstruct ', '\nimpl ', '\nenum '],
    '.java': ['\npublic ', '\nprivate ', '\nprotected ', '\nclass ', '\ninterface '],
    '.kt':   ['\nfun ', '\nclass ', '\nobject ', '\ninterface '],
    '.rb':   ['\ndef ', '\nclass ', '\nmodule '],
    '.cs':   ['\npublic ', '\nprivate ', '\nprotected ', '\nclass ', '\ninterface '],
    '.php':  ['\nfunction ', '\nclass ', '\npublic ', '\nprivate '],
    '.swift': ['\nfunc ', '\nclass ', '\nstruct ', '\nenum '],
    '.scala': ['\ndef ', '\nclass ', '\nobject ', '\ntrait '],
}

_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=settings.gemini_api_key or None)
    return _gemini_client


# ── File classification ───────────────────────────────────────────────────────

def _file_kind(path: str) -> str:
    ext = PurePosixPath(path).suffix.lower()
    name = PurePosixPath(path).name.lower()
    if ext in _MD_EXTS:
        return 'markdown'
    if ext in _CONFIG_EXTS or name in _CONFIG_NAMES or (not ext and '/' not in path):
        return 'config'
    return 'source'


# ── Chunking ──────────────────────────────────────────────────────────────────

def _split_with_overlap(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text.strip() else []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            nl = text.rfind('\n', start + max_chars // 2, end)
            if nl > start:
                end = nl + 1
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(start + 1, end - overlap_chars)
    return chunks


def _chunk_source(path: str, content: str) -> list[tuple[str, int]]:
    ext = PurePosixPath(path).suffix.lower()
    boundaries = _SRC_BOUNDARIES.get(ext, [])
    header = f"### {path}\n"

    if boundaries:
        pattern = "(" + "|".join(re.escape(b) for b in boundaries) + ")"
        parts = re.split(pattern, content)
        raw_sections: list[str] = []
        current = ""
        for part in parts:
            candidate = current + part
            if len(candidate) > SOURCE_MAX_CHARS and current:
                raw_sections.append(current)
                current = part
            else:
                current = candidate
        if current.strip():
            raw_sections.append(current)
    else:
        raw_sections = [b for b in re.split(r'\n\n+', content) if b.strip()]

    result = []
    for raw in raw_sections:
        if not raw.strip():
            continue
        for sub in _split_with_overlap(raw, SOURCE_MAX_CHARS, OVERLAP_CHARS):
            text = header + sub
            result.append((text, len(text) // 4))
    return result


def _chunk_markdown(path: str, content: str) -> list[tuple[str, int]]:
    sections = re.split(r'\n(?=#{1,6} )', content)
    result = []
    parent_heading = ""
    for section in sections:
        if not section.strip():
            continue
        first_line = section.split('\n', 1)[0]
        if first_line.startswith('#'):
            parent_heading = first_line

        header = f"### {path}\n"
        if parent_heading and not section.startswith(parent_heading):
            header += f"{parent_heading}\n\n"

        for sub in _split_with_overlap(section, MARKDOWN_MAX_CHARS, OVERLAP_CHARS):
            text = header + sub
            result.append((text, len(text) // 4))

    if not result:
        text = f"### {path}\n{content[:MARKDOWN_MAX_CHARS]}"
        result.append((text, len(text) // 4))
    return result


def _chunk_config(path: str, content: str) -> list[tuple[str, int]]:
    header = f"### {path}\n"
    if len(content) <= CONFIG_MAX_CHARS:
        text = header + content
        return [(text, len(text) // 4)]
    result = []
    for sub in _split_with_overlap(content, CONFIG_MAX_CHARS, OVERLAP_CHARS):
        text = header + sub
        result.append((text, len(text) // 4))
    return result


def _chunk_file(path: str, content: str) -> list[tuple[str, int]]:
    kind = _file_kind(path)
    if kind == 'source':
        return _chunk_source(path, content)
    if kind == 'markdown':
        return _chunk_markdown(path, content)
    return _chunk_config(path, content)


def _chunk_all_files(files: list[tuple[str, str]]) -> list[dict]:
    result = []
    for file_path, content in files:
        for idx, (text, tokens) in enumerate(_chunk_file(file_path, content)):
            result.append({
                'file_path': file_path,
                'chunk_index': idx,
                'content': text,
                'token_estimate': tokens,
            })
    return result


# ── Large-repo filter (>1000 files) ──────────────────────────────────────────

def _filter_large_repo(blobs: list[str]) -> list[str]:
    """Keep only top-2-level source files + README + /docs for oversized repos."""
    kept = []
    for path in blobs:
        parts = path.split('/')
        depth = len(parts) - 1
        name = parts[-1].lower()
        ext = PurePosixPath(path).suffix.lower()
        # Always keep: README files anywhere, /docs directory
        if 'readme' in name or (parts[0].lower() == 'docs'):
            kept.append(path)
        # Source files: only depth ≤ 1
        elif depth <= 1 and ext not in _MD_EXTS:
            kept.append(path)
    return kept


# ── GitHub API fetch ──────────────────────────────────────────────────────────

class _RateLimitError(Exception):
    pass


async def _async_fetch_via_api(
    owner: str, repo: str, default_branch: str, headers: dict
) -> tuple[list[tuple[str, str]], str | None]:
    from ..github_fetcher import _should_include, _priority_score

    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        tree_r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
        )
        if tree_r.status_code in (403, 429):
            raise _RateLimitError("GitHub API rate limited")
        tree_r.raise_for_status()

        tree_data = tree_r.json()
        blobs = [
            item['path'] for item in tree_data.get('tree', [])
            if item['type'] == 'blob' and _should_include(item['path'])
        ]

        truncation_note = None
        if len(blobs) > MAX_FILES_AFTER_FILTER:
            truncation_note = (
                f"Repo has {len(blobs)} files after filtering; "
                f"applying large-repo rules (top-2-level source + docs only)."
            )
            logging.warning(f"Indexer: {truncation_note}")
            blobs = _filter_large_repo(blobs)

        blobs.sort(key=_priority_score)
        blobs = blobs[:MAX_FILES_AFTER_FILTER]

        raw_base = f"https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}"
        sem = asyncio.Semaphore(20)

        async def _fetch_one(path: str) -> tuple[str, str]:
            async with sem:
                try:
                    r = await client.get(f"{raw_base}/{path}")
                    if r.status_code == 200:
                        content = r.text
                        if len(content.encode('utf-8', errors='replace')) > MAX_FILE_BYTES:
                            content = content[:MAX_FILE_BYTES // 4] + "\n\n... [file truncated]"
                        return path, content
                except Exception:
                    pass
                return path, ""

        results = await asyncio.gather(*[_fetch_one(p) for p in blobs])
        return [(p, c) for p, c in results if c.strip()], truncation_note


# ── Git clone fallback ────────────────────────────────────────────────────────

def _fetch_via_clone(owner: str, repo: str, default_branch: str) -> tuple[list[tuple[str, str]], str | None]:
    from ..github_fetcher import _should_include

    tmp_dir = f"/tmp/learnone/{owner}_{repo}_{uuid.uuid4().hex[:8]}"
    os.makedirs("/tmp/learnone", exist_ok=True)
    truncation_note = None

    try:
        subprocess.run(
            ["git", "clone", "--depth=1", "--single-branch",
             "--branch", default_branch,
             f"https://github.com/{owner}/{repo}.git", tmp_dir],
            check=True, capture_output=True, timeout=300,
        )

        all_files = []
        repo_path = Path(tmp_dir)
        for file_path in sorted(repo_path.rglob("*")):
            if not file_path.is_file():
                continue
            rel = str(file_path.relative_to(repo_path)).replace("\\", "/")
            if not _should_include(rel):
                continue
            try:
                if file_path.stat().st_size > MAX_FILE_BYTES:
                    continue
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                if content.strip():
                    all_files.append((rel, content))
            except Exception:
                pass

        if len(all_files) > MAX_FILES_AFTER_FILTER:
            truncation_note = (
                f"Repo has {len(all_files)} files; "
                f"applying large-repo rules (top-2-level source + docs only)."
            )
            logging.warning(f"Indexer: {truncation_note}")
            paths = _filter_large_repo([p for p, _ in all_files])
            path_set = set(paths[:MAX_FILES_AFTER_FILTER])
            all_files = [(p, c) for p, c in all_files if p in path_set]

        return all_files, truncation_note

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Fetch dispatcher ──────────────────────────────────────────────────────────

def _fetch_repo_files(repo_url: str) -> tuple[str, str, str, list[tuple[str, str]], str | None]:
    """Returns (owner, repo_name, default_branch, files, truncation_note)."""
    from ..github_fetcher import _parse_github_url

    owner, repo_name = _parse_github_url(repo_url)

    headers = {
        'User-Agent': 'LearnOne-Indexer/1.0',
        'Accept': 'application/vnd.github.v3+json',
    }
    if settings.github_token:
        headers['Authorization'] = f'Bearer {settings.github_token}'

    resp = httpx.get(f"{GITHUB_API}/repos/{owner}/{repo_name}", headers=headers, timeout=30)
    if resp.status_code == 404:
        raise ValueError(f"Repository '{owner}/{repo_name}' not found or is private")
    if resp.status_code in (403, 429):
        raise ValueError(
            "GitHub API rate limit reached. "
            "Set GITHUB_TOKEN environment variable to raise the limit to 5000 req/hour."
        )
    resp.raise_for_status()

    meta = resp.json()
    default_branch = meta.get('default_branch', 'main')
    size_mb = meta.get('size', 0) / 1024  # GitHub reports size in KB

    if size_mb > MAX_REPO_MB:
        raise ValueError(
            f"Repository too large to index ({size_mb:.0f} MB > {MAX_REPO_MB} MB limit)"
        )

    if size_mb > CLONE_THRESHOLD_MB:
        logging.info(f"Indexer: {owner}/{repo_name} is {size_mb:.0f} MB — using git clone")
        files, note = _fetch_via_clone(owner, repo_name, default_branch)
    else:
        logging.info(f"Indexer: {owner}/{repo_name} is {size_mb:.0f} MB — using GitHub API")
        try:
            files, note = asyncio.run(_async_fetch_via_api(owner, repo_name, default_branch, headers))
        except _RateLimitError:
            logging.warning("Indexer: GitHub API rate limited, falling back to git clone")
            files, note = _fetch_via_clone(owner, repo_name, default_branch)

    return owner, repo_name, default_branch, files, note


# ── Embedding ─────────────────────────────────────────────────────────────────

def _embed_batch(texts: list[str]) -> list[list[float]] | None:
    """Embed a batch of texts. Retries 3× with exponential backoff, then pauses 60s."""
    from google.genai import types as gtypes

    client = _get_gemini_client()
    for attempt in range(3):
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=gtypes.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
            )
            return [list(e.values) for e in result.embeddings]
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                delay = 5 * (2 ** attempt)  # 5s, 10s, 20s
                logging.warning(
                    f"Indexer: embedding rate limit (attempt {attempt + 1}/3), waiting {delay}s"
                )
                time.sleep(delay)
            else:
                logging.error(f"Indexer: embedding error: {e}")
                return None

    # All retries exhausted → pause 60s, one final attempt
    logging.warning(f"Indexer: embedding retries exhausted, pausing {RATE_LIMIT_PAUSE_SECS}s")
    time.sleep(RATE_LIMIT_PAUSE_SECS)
    try:
        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config=gtypes.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
        )
        return [list(e.values) for e in result.embeddings]
    except Exception as e:
        logging.error(f"Indexer: embedding failed after 60s pause: {e}")
        return None


# ── DB helpers ────────────────────────────────────────────────────────────────

def _update_status(db, repo_id: int, status: str, **kwargs) -> None:
    from ..models import IndexedRepo
    row = db.get(IndexedRepo, repo_id)
    if not row:
        return
    row.status = status
    for k, v in kwargs.items():
        setattr(row, k, v)
    db.commit()


def _delete_existing_chunks(db, repo_id: int) -> None:
    from sqlalchemy import text
    db.execute(text("DELETE FROM repo_chunks WHERE repo_id = :rid"), {"rid": repo_id})
    db.commit()


def _embed_and_store(db, repo_id: int, chunks: list[dict]) -> int:
    """Embed in batches of CHUNK_BATCH_SIZE, store in DB. Updates chunk_count live."""
    from sqlalchemy import text
    from ..models import IndexedRepo

    total = 0
    stmt = text(
        "INSERT INTO repo_chunks "
        "(repo_id, file_path, chunk_index, content, token_estimate, embedding) "
        "VALUES (:repo_id, :file_path, :chunk_index, :content, :token_estimate, "
        "CAST(:embedding AS vector))"
    )

    for i in range(0, len(chunks), CHUNK_BATCH_SIZE):
        batch = chunks[i:i + CHUNK_BATCH_SIZE]
        texts = [c['content'] for c in batch]

        embeddings = _embed_batch(texts)
        if embeddings is None:
            logging.warning(
                f"Indexer: skipping batch {i // CHUNK_BATCH_SIZE + 1} "
                f"(chunks {i}–{i + len(batch) - 1}) due to persistent embed failure"
            )
            continue

        for chunk, emb in zip(batch, embeddings):
            vec_str = "[" + ",".join(str(v) for v in emb) + "]"
            db.execute(stmt, {
                'repo_id': repo_id,
                'file_path': chunk['file_path'],
                'chunk_index': chunk['chunk_index'],
                'content': chunk['content'],
                'token_estimate': chunk['token_estimate'],
                'embedding': vec_str,
            })

        db.commit()
        total += len(batch)

        # Live progress update
        row = db.get(IndexedRepo, repo_id)
        if row:
            row.chunk_count = total
            db.commit()

    return total


# ── Pipeline entry point ──────────────────────────────────────────────────────

def run_indexing_pipeline(repo_id: int, repo_url: str) -> None:
    """
    Full pipeline: fetch → chunk → embed → store.
    Called in a daemon thread. Try/finally guarantees DB close.
    Temp clone dirs are cleaned up inside _fetch_via_clone's finally block.
    """
    db = SessionLocal()
    try:
        _update_status(db, repo_id, 'fetching')

        owner, repo_name, default_branch, files, truncation_note = _fetch_repo_files(repo_url)

        _update_status(db, repo_id, 'indexing', file_count=len(files))

        chunks = _chunk_all_files(files)
        logging.info(
            f"Indexer: {owner}/{repo_name} — {len(files)} files → {len(chunks)} chunks"
        )

        # Upsert: remove old chunks in case this is a re-index
        _delete_existing_chunks(db, repo_id)

        total_stored = _embed_and_store(db, repo_id, chunks)

        from ..models import IndexedRepo
        row = db.get(IndexedRepo, repo_id)
        if row:
            row.status = 'ready'
            row.chunk_count = total_stored
            row.indexed_at = datetime.now(timezone.utc)
            if truncation_note:
                row.error_message = truncation_note
            db.commit()

        # Auto-trigger repo analyst to build story for animation pipeline
        import threading as _threading
        from .repo_analyst import run_repo_analysis as _run_repo_analysis
        _threading.Thread(
            target=_run_repo_analysis, args=(repo_id,), daemon=True
        ).start()
        logging.info("Indexer: launched analyst for repo_id=%s", repo_id)

        logging.info(
            f"Indexer: {owner}/{repo_name} ready — "
            f"{total_stored} chunks stored (repo_id={repo_id})"
        )

    except Exception as e:
        logging.error(f"Indexer: pipeline failed for repo_id={repo_id}: {e}", exc_info=True)
        try:
            _update_status(db, repo_id, 'failed', error_message=str(e)[:500])
        except Exception:
            pass
    finally:
        db.close()
