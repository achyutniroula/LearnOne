"""Stage 2: Scriptwriter service — produces animation_scripts from repo_stories."""
import logging
import json
import re

from ..database import SessionLocal
from ..models import RepoStory, AnimationScript, LearningSession
from ..llm_registry import GENERATION_MAX_TOKENS
from .thinker import generate_with_fallback
from .script_validator import validate_script, safe_default_script

logger = logging.getLogger(__name__)

SCRIPTWRITER_PROMPT = """You are a world-class explainer. Write an animation script for an interactive whiteboard with synchronized voice narration by LEON. Repo story: {repo_story}. Return ONLY valid JSON, no markdown, no trailing commas. Output this exact structure: {{ "overview": {{ "total_duration_ms": 0, "scenes": [ {{ "scene_id": "s1", "duration_ms": 4000, "narration": {{ "text": "Spoken text.", "delivery": "calm", "pause_before_ms": 0 }}, "animation": {{ "type": "fade_in_title", "title": "Title", "subtitle": "Subtitle" }}, "canvas_state": "Title card visible" }} ] }}, "components": [ {{ "character_id": "id", "click_target": {{ "label": "Label", "position": {{ "x": 0.5, "y": 0.5 }} }}, "deep_dive": {{ "scenes": [] }} }} ] }}. ALLOWED ANIMATION TYPES — renderer knows no others, use only these exactly: fade_in_title with fields title and subtitle. set_background with field style as whiteboard or dark or blueprint. appear_character with fields id, label, icon as one of browser|server|database|cache|ai|user|queue|file, position as x and y floats 0.0 to 1.0, color as one of blue|green|purple|orange|red|teal. highlight_character with fields id and pulse boolean. label_character with fields id and annotation string. draw_connection with fields from, to, label, style as solid|dashed|animated, direction as one_way|two_way. animate_flow with fields connection_id and particle as one of data|audio|request|response. highlight_connection with fields from and to. zoom_to with fields target_id and scale float. zoom_out with no fields. spotlight with fields target_id and dim_others boolean. reveal_code with fields file, lines as array of two integers, annotation string. show_callout with fields text, target_id, style as thought|speech|label. show_analogy with fields text and icon as one of restaurant|airport|postoffice|factory|library. step_sequence with fields steps as array of strings and style as numbered|arrow_chain. NARRATION RULES: max 2 sentences per scene, max 25 words per sentence, write for the ear with no lists or colons or jargon without explanation, address user as you directly, use analogies from repo_story and do not invent new ones, use delivery conspiratorial for most_interesting reveal, use delivery excited for first main character appearance, set pause_before_ms to 800 before the most important scene, end overview narration with a question inviting the user to explore. PACING RULES: scenes 1 and 2 should be 4000 to 5000ms, middle scenes 3000 to 4000ms, connection and flow scenes 2000 to 3000ms, minimum 2000ms never rush, overview target 90 to 120 seconds total. STORY STRUCTURE follow exactly: scene 1 is the problem this repo solves — why it exists not what it is. Scene 2 is the one-line analogy — make it land. Scenes 3 through 5 introduce main characters one by one with appear_character. Scenes 6 onward animate how they work together using draw_connection and animate_flow. Second-to-last scene is most_interesting reveal with conspiratorial delivery and spotlight. Last scene is the invitation — click any piece to go deeper. DEEP DIVE structure per component with 3 to 5 scenes each: scene 1 zooms in and states what this component's specific job is. Scene 2 covers its key files and how it works internally. Scene 3 covers its most important relationship with another component. Scene 4 optional addresses common_confusion for this component directly. Scene 5 optional uses reveal_code on its core logic file."""

CORRECTION_PROMPT = """Your animation script had validation errors. Fix ONLY the errors listed below and return the complete corrected JSON with no other changes. Errors: {errors}. Original script: {script}."""


def run_script_generation(session_id: int) -> None:
    """
    Stage 2 pipeline: load session + story → call LLM → validate → upsert animation_scripts.
    Called in a daemon thread. Opens its own DB session.
    """
    db = SessionLocal()
    script_row = None
    try:
        # Load session
        session = db.get(LearningSession, session_id)
        if not session:
            logger.warning("Script writer: session_id=%s not found", session_id)
            return

        repo_id = session.repo_id
        if not repo_id:
            logger.warning("Script writer: session_id=%s has no repo_id", session_id)
            return

        # Load repo story
        story_row = db.query(RepoStory).filter(RepoStory.repo_id == repo_id).first()
        if not story_row or story_row.status != "ready":
            logger.warning(
                "Script writer: repo_id=%s story not ready (status=%s)",
                repo_id,
                story_row.status if story_row else "missing",
            )
            return

        story = story_row.story

        # Upsert AnimationScript row
        existing = db.query(AnimationScript).filter(
            AnimationScript.session_id == session_id
        ).first()
        if existing:
            existing.status = "pending"
            existing.error = None
            db.commit()
            script_row = existing
        else:
            script_row = AnimationScript(
                session_id=session_id,
                repo_id=repo_id,
                script={},
                status="pending",
            )
            db.add(script_row)
            db.commit()
            db.refresh(script_row)

        # Call LLM
        prompt = SCRIPTWRITER_PROMPT.format(repo_story=json.dumps(story))
        raw = generate_with_fallback(prompt, max_output_tokens=GENERATION_MAX_TOKENS)
        cleaned = re.sub(r'^```[a-z]*\n?|\n?```$', '', raw.strip())
        try:
            script = json.loads(cleaned)
        except json.JSONDecodeError as parse_err:
            logger.warning(
                "Script writer: session_id=%s initial JSON parse failed (%s), using safe_default",
                session_id, parse_err,
            )
            script = safe_default_script(story)
        else:
            # Validate only when parse succeeded
            errors = validate_script(script, story)
            if errors:
                logger.warning(
                    "Script writer: session_id=%s initial validation errors: %s", session_id, errors
                )
                # One correction retry
                correction = CORRECTION_PROMPT.format(
                    errors="\n".join(errors),
                    script=json.dumps(script),
                )
                raw2 = generate_with_fallback(correction, max_output_tokens=GENERATION_MAX_TOKENS)
                cleaned2 = re.sub(r'^```[a-z]*\n?|\n?```$', '', raw2.strip())
                try:
                    script = json.loads(cleaned2)
                except json.JSONDecodeError as parse_err2:
                    logger.warning(
                        "Script writer: session_id=%s retry JSON parse failed (%s), using safe_default",
                        session_id, parse_err2,
                    )
                    script = safe_default_script(story)
                else:
                    errors = validate_script(script, story)
                    if errors:
                        logger.warning(
                            "Script writer: session_id=%s still has errors after retry, using safe_default. Errors: %s",
                            session_id, errors,
                        )
                        script = safe_default_script(story)

        # Write to DB (validator always runs before this write)
        script_row.script = script
        script_row.status = "ready"
        db.commit()
        logger.info("Script writer: session_id=%s script ready", session_id)

    except Exception as e:
        logger.error(
            "Script writer: session_id=%s failed: %s", session_id, e, exc_info=True
        )
        try:
            if script_row:
                script_row.status = "failed"
                script_row.error = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        logger.info("Script writer: session_id=%s thread complete", session_id)
