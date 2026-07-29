"""
Repo explainer generation service.

Generates four cached, book-style sections (preface, contents, pipeline, indepth)
per (repo_id, mode) pair, backed by the repo_explanations table. Each section is
retrieved via RAG over repo_chunks and generated through the thinker fallback chain.
"""

import json
import logging
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..llm_registry import EXPLAINER_TOP_K
from ..models import IndexedRepo, RepoExplanation
from .rag import retrieve_context
from .thinker import generate_with_fallback

logger = logging.getLogger(__name__)

SECTIONS = ("preface", "contents", "pipeline", "indepth")

MAX_DIAGRAM_NODES = 5
MAX_PIPELINE_STEPS = 4
MAX_LABEL_WORDS = 6

MODE_TONES = {
    "noobie": (
        "Explain like the reader has never coded before. No jargon without an "
        "immediate plain-English definition. Use everyday analogies (restaurants, "
        "mail, libraries). Short sentences."
    ),
    "normal": (
        "Explain at the level of a competent developer new to this specific "
        "codebase. Standard technical vocabulary is fine. Be precise and concise."
    ),
}

# Seed queries used to pull relevant chunks per section via RAG.
_SEED_QUERIES = {
    "preface": "project overview, purpose, what this repository does and why it exists",
    "contents": "main components, modules, directory structure, high-level architecture",
    "pipeline": "request flow, data flow, how the main process or pipeline works end to end",
    "indepth": "core implementation details of the most important components and files",
}

DIAGRAM_SPEC_RULES = """
If a diagram is useful, include it as a "diagram" field with EXACTLY this JSON shape:
{{"type": "flow"|"hierarchy"|"sequence", "nodes": [{{"id": "short_id", "label": "short label"}}], "edges": [{{"from": "id", "to": "id", "label": "optional"}}]}}
Rules for the diagram:
- At most {max_nodes} nodes.
- Node ids must match ^[A-Za-z0-9_]+$ and be unique.
- Every label must be {max_label_words} words or fewer.
- Every edge's "from" and "to" must reference an existing node id.
- If no diagram is useful, omit the "diagram" field or set it to null.
"""

PREFACE_PROMPT = """You are writing the preface of a book-style explainer for the GitHub repository "{repo}".
Tone: {tone}

Repository context (retrieved code/docs excerpts):
{context}

Return ONLY a JSON object with this exact shape (no markdown fences, no extra commentary):
{{"one_line": "one sentence summary", "what_it_does": "1-3 paragraph explanation of what the project does", "why_it_exists": "1-2 paragraph explanation of the problem it solves / motivation", "diagram": null}}
""" + DIAGRAM_SPEC_RULES

CONTENTS_PROMPT = """You are writing the table of contents for a book-style explainer for the GitHub repository "{repo}".
Tone: {tone}

Repository context (retrieved code/docs excerpts):
{context}

List the main components/modules of this codebase. For each, give a short name, a plain description of its responsibility, and the key file paths that belong to it.

Return ONLY a JSON object with this exact shape (no markdown fences, no extra commentary):
{{"components": [{{"name": "Component Name", "description": "what it does", "files": ["path/to/file.py"]}}]}}
"""

PIPELINE_PROMPT = """You are writing the "how it works" chapter of a book-style explainer for the GitHub repository "{repo}".
Tone: {tone}

Repository context (retrieved code/docs excerpts):
{context}

Describe the main end-to-end pipeline or request/data flow as a sequence of at most {max_steps} steps, like book chapters. Each step needs a title and a clear description of what happens at that stage.

Return ONLY a JSON object with this exact shape (no markdown fences, no extra commentary):
{{"steps": [{{"step_number": 1, "title": "Step title", "description": "what happens in this step", "diagram": null}}]}}
""" + DIAGRAM_SPEC_RULES

INDEPTH_PROMPT = """You are writing the in-depth reference chapter of a book-style explainer for the GitHub repository "{repo}".
Tone: {tone}

Repository context (retrieved code/docs excerpts):
{context}

Explain the most important components in technical depth (at most 5 components). For each, give the component name, a thorough explanation, and the single most relevant file path (do NOT guess or invent line numbers).

Return ONLY a JSON object with this exact shape (no markdown fences, no extra commentary):
{{"sections": [{{"component_name": "Name", "explanation": "in-depth explanation", "code_reference": {{"file": "path/to/file.py", "lines": null}}, "diagram": null}}]}}
""" + DIAGRAM_SPEC_RULES


def _retrieve(repo_id: int, query: str, db: Session, top_k: int = EXPLAINER_TOP_K) -> str:
    return retrieve_context(query, db, top_k=top_k, repo_id=repo_id)


def _call_llm(prompt: str, system: str) -> str:
    return generate_with_fallback(prompt, system=system)


def _parse_json(raw: str) -> dict:
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences if present.
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    return json.loads(text)


_ID_RE = re.compile(r"^[A-Za-z0-9_]+$")


def validate_diagram(spec: dict | None, max_nodes: int = MAX_DIAGRAM_NODES) -> list[str]:
    """Returns a list of validation error strings; [] means valid (including spec=None)."""
    if spec is None:
        return []
    errors: list[str] = []
    if not isinstance(spec, dict):
        return ["diagram must be an object"]

    dtype = spec.get("type")
    if dtype not in ("flow", "hierarchy", "sequence"):
        errors.append('diagram.type must be one of "flow", "hierarchy", "sequence"')

    nodes = spec.get("nodes")
    if not isinstance(nodes, list) or not (1 <= len(nodes) <= max_nodes):
        errors.append(f"diagram.nodes must be a list of 1-{max_nodes} items")
        nodes = nodes if isinstance(nodes, list) else []

    node_ids = set()
    for n in nodes:
        if not isinstance(n, dict) or "id" not in n or "label" not in n:
            errors.append("each node needs an id and a label")
            continue
        nid = str(n["id"])
        if not _ID_RE.match(nid):
            errors.append(f"node id '{nid}' must match ^[A-Za-z0-9_]+$")
        if nid in node_ids:
            errors.append(f"duplicate node id '{nid}'")
        node_ids.add(nid)
        label = str(n.get("label", ""))
        if len(label.split()) > MAX_LABEL_WORDS:
            errors.append(f"label '{label}' exceeds {MAX_LABEL_WORDS} words")

    edges = spec.get("edges", [])
    if not isinstance(edges, list):
        errors.append("diagram.edges must be a list")
        edges = []
    for e in edges:
        if not isinstance(e, dict) or "from" not in e or "to" not in e:
            errors.append("each edge needs 'from' and 'to'")
            continue
        if str(e["from"]) not in node_ids:
            errors.append(f"edge references unknown node id '{e['from']}'")
        if str(e["to"]) not in node_ids:
            errors.append(f"edge references unknown node id '{e['to']}'")

    return errors


def _validate_content_diagrams(content: dict, max_nodes: int) -> list[str]:
    """Collects diagram validation errors from any 'diagram' keys found in content."""
    errors: list[str] = []

    def _walk(obj):
        if isinstance(obj, dict):
            if "diagram" in obj:
                errs = validate_diagram(obj["diagram"], max_nodes)
                if errs:
                    errors.extend(errs)
                    obj["diagram"] = None
            for v in obj.values():
                _walk(v)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)

    _walk(content)
    return errors


def _generate_validated(prompt: str, system: str, max_nodes: int = MAX_DIAGRAM_NODES) -> dict:
    raw = _call_llm(prompt, system)
    try:
        content = _parse_json(raw)
    except Exception as e:
        raise RuntimeError(f"Model returned invalid JSON: {e}")

    errors = _validate_content_diagrams(content, max_nodes)
    if errors:
        retry_prompt = (
            prompt
            + "\n\nYour previous response had invalid diagram data. Errors:\n"
            + "\n".join(f"- {e}" for e in errors)
            + "\nReturn the corrected JSON object only."
        )
        try:
            raw2 = _call_llm(retry_prompt, system)
            content2 = _parse_json(raw2)
            errors2 = _validate_content_diagrams(content2, max_nodes)
            if not errors2:
                return content2
            # Still invalid after retry — strip diagrams but keep the rest, never raise.
            _strip_diagrams(content2)
            return content2
        except Exception:
            # Retry failed entirely — fall back to the original content with diagrams stripped.
            return content

    return content


def _strip_diagrams(obj):
    if isinstance(obj, dict):
        if "diagram" in obj:
            obj["diagram"] = None
        for v in obj.values():
            _strip_diagrams(v)
    elif isinstance(obj, list):
        for item in obj:
            _strip_diagrams(item)


def _cache(repo_id: int, mode: str, section: str, content: dict | None, status: str, error: str | None, db: Session) -> None:
    row = (
        db.query(RepoExplanation)
        .filter(
            RepoExplanation.repo_id == repo_id,
            RepoExplanation.mode == mode,
            RepoExplanation.section == section,
        )
        .first()
    )
    if row is None:
        row = RepoExplanation(repo_id=repo_id, mode=mode, section=section)
        db.add(row)
    row.status = status
    row.error = error
    if content is not None:
        row.content = content
    if status == "ready":
        row.generated_at = datetime.now(timezone.utc)
    db.commit()


def _get_row(repo_id: int, mode: str, section: str, db: Session) -> RepoExplanation | None:
    return (
        db.query(RepoExplanation)
        .filter(
            RepoExplanation.repo_id == repo_id,
            RepoExplanation.mode == mode,
            RepoExplanation.section == section,
        )
        .first()
    )


def _get_repo_name(repo_id: int, db: Session) -> str:
    repo = db.get(IndexedRepo, repo_id)
    return f"{repo.owner}/{repo.repo_name}" if repo else f"repo #{repo_id}"


def _run_section(repo_id: int, mode: str, section: str, prompt_template: str, max_nodes: int, extra_fmt: dict, db: Session) -> dict:
    existing = _get_row(repo_id, mode, section, db)
    if existing is not None and existing.status == "ready":
        return existing.content

    _cache(repo_id, mode, section, None, "generating", None, db)

    try:
        repo_name = _get_repo_name(repo_id, db)
        context = _retrieve(repo_id, _SEED_QUERIES[section], db)
        tone = MODE_TONES[mode]
        prompt = prompt_template.format(
            tone=tone,
            context=context or "(no additional context retrieved)",
            repo=repo_name,
            max_nodes=max_nodes,
            max_label_words=MAX_LABEL_WORDS,
            **extra_fmt,
        )
        system = "You are a precise technical writer that outputs strictly valid JSON."
        content = _generate_validated(prompt, system, max_nodes)
        _cache(repo_id, mode, section, content, "ready", None, db)
        return content
    except Exception as e:
        logger.error(f"explainer_service: section '{section}' failed for repo {repo_id}: {e}")
        _cache(repo_id, mode, section, None, "failed", str(e)[:2000], db)
        raise


def generate_preface(repo_id: int, mode: str, db: Session) -> dict:
    return _run_section(repo_id, mode, "preface", PREFACE_PROMPT, MAX_DIAGRAM_NODES, {}, db)


def generate_contents(repo_id: int, mode: str, db: Session) -> dict:
    return _run_section(repo_id, mode, "contents", CONTENTS_PROMPT, MAX_DIAGRAM_NODES, {}, db)


def generate_pipeline(repo_id: int, mode: str, db: Session) -> dict:
    return _run_section(
        repo_id, mode, "pipeline", PIPELINE_PROMPT, MAX_DIAGRAM_NODES,
        {"max_steps": MAX_PIPELINE_STEPS}, db,
    )


def generate_indepth(repo_id: int, mode: str, db: Session) -> dict:
    # NOTE: thinker.generate_with_fallback does not currently support overriding
    # THINKER_CHAIN per call, so restricting in-depth generation to Gemini-only
    # models is skipped here rather than hacked in. See explainer_service module
    # docstring / task notes.
    return _run_section(repo_id, mode, "indepth", INDEPTH_PROMPT, MAX_DIAGRAM_NODES, {}, db)


_SECTION_FUNCS = {
    "preface": generate_preface,
    "contents": generate_contents,
    "pipeline": generate_pipeline,
    "indepth": generate_indepth,
}


def generate_all_sections(repo_id: int, mode: str) -> None:
    """
    Background entry point. Opens its own DB session and runs all 4 sections
    sequentially in this single thread (not 4 threads) to stay within Render
    free-tier memory/connection limits. Each section catches its own errors
    internally and continues to the next.
    """
    db = SessionLocal()
    try:
        for section in SECTIONS:
            try:
                _SECTION_FUNCS[section](repo_id, mode, db)
            except Exception:
                # Already logged and cached as 'failed' inside _run_section.
                continue
    finally:
        db.close()
