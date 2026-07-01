"""Stage 1: Analyst service — produces repo_stories from indexed chunks."""
import logging
import json
import re

from sqlalchemy import text

from ..database import SessionLocal
from ..models import IndexedRepo, RepoStory
from ..llm_registry import ANALYST_CHUNK_LIMIT, GENERATION_MAX_TOKENS
from .thinker import generate_with_fallback

logger = logging.getLogger(__name__)

ANALYST_PROMPT = """You are a senior software engineer analyzing a codebase to build a structured narrative understanding for a beginner explainer tool. Repo name: {repo_name}. Chunks: {chunks}. Return ONLY valid JSON, no markdown, no trailing commas. Output this exact structure: {{ "repo_identity": {{ "name": "string", "one_line": "What this does in one plain sentence", "analogy": "This is like [universal real-world thing] because [reason]", "problem_solved": "The human problem this solves" }}, "characters": [ {{ "id": "snake_case_unique_id", "name": "Human-readable name", "role": "This component's job in one sentence", "personality": "If this were a person they would be [analogy]", "files": ["key/file/paths"], "relationships": [ {{ "with": "other_id", "nature": "what they do together" }} ] }} ], "story_arc": [ {{ "beat": 1, "title": "Beat title", "what_happens": "Concept to explain", "characters_involved": ["ids"], "analogy": "Real-world analogy — no software analogies allowed", "common_confusion": "What beginners always misunderstand here" }} ], "entry_points": ["file/paths/to/read/first"], "most_interesting": "The single most clever or surprising thing in this codebase" }}. Rules: analogies must be universally familiar such as restaurants, airports, libraries — never other software. Characters are actors with distinct personalities not folder names. story_arc tells a complete story from problem to solution to how parts work together. common_confusion is mandatory for every beat. Max 6 characters. Max 8 story beats."""


def run_repo_analysis(repo_id: int) -> None:
    """
    Stage 1 pipeline: read chunks → call LLM → upsert repo_stories row.
    Called in a daemon thread. Opens its own DB session.
    """
    story_row = None
    db = SessionLocal()
    try:
        # Upsert RepoStory row
        existing = db.query(RepoStory).filter(RepoStory.repo_id == repo_id).first()
        if existing:
            existing.status = "pending"
            existing.error = None
            db.commit()
            story_row = existing
        else:
            story_row = RepoStory(repo_id=repo_id, story={}, status="pending")
            db.add(story_row)
            db.commit()
            db.refresh(story_row)

        # Fetch top chunks
        result = db.execute(
            text(
                "SELECT file_path, content FROM repo_chunks "
                "WHERE repo_id = :rid ORDER BY file_path LIMIT :lim"
            ),
            {"rid": repo_id, "lim": ANALYST_CHUNK_LIMIT},
        )
        chunks_text = "\n\n---\n\n".join(
            f"# {row.file_path}\n{row.content}" for row in result
        )

        # Get repo name
        repo = db.get(IndexedRepo, repo_id)
        repo_name = repo.repo_name if repo else str(repo_id)

        # Call LLM
        prompt = ANALYST_PROMPT.replace("{repo_name}", repo_name).replace("{chunks}", chunks_text)
        raw = generate_with_fallback(prompt, max_output_tokens=GENERATION_MAX_TOKENS)

        # Strip markdown fences
        cleaned = re.sub(r'^```[a-z]*\n?|\n?```$', '', raw.strip())

        # Parse JSON
        parsed = json.loads(cleaned)

        # Success: update row
        story_row.story = parsed
        story_row.status = "ready"
        db.commit()
        logger.info("Analyst: repo_id=%s story ready", repo_id)

    except Exception as e:
        logger.error("Analyst: repo_id=%s failed: %s", repo_id, e, exc_info=True)
        try:
            if story_row:
                story_row.status = "failed"
                story_row.error = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        logger.info("Analyst: repo_id=%s thread complete", repo_id)
