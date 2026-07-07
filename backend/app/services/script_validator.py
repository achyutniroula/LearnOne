"""Validates animation scripts before writing to DB and provides a safe fallback."""

import re

ALLOWED_ANIMATION_TYPES: set[str] = {
    "fade_in_title",
    "set_background",
    "appear_character",
    "highlight_character",
    "label_character",
    "draw_connection",
    "animate_flow",
    "highlight_connection",
    "zoom_to",
    "zoom_out",
    "spotlight",
    "reveal_code",
    "show_callout",
    "show_analogy",
    "step_sequence",
}

_SENTENCE_SPLIT = re.compile(r'(?<=[\.\!\?])\s+')


def _count_sentences(text: str) -> list[str]:
    """Split on '. ', '! ', '? ' boundaries."""
    return [s.strip() for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]


def _as_dict(value) -> dict:
    """LLM output can put a scalar where an object was expected — coerce defensively."""
    return value if isinstance(value, dict) else {}


def _check_scenes(scenes: list, introduced: set, context: str, errors: list[str]) -> None:
    """Walk scenes in order; update introduced set as appear_character scenes are seen."""
    for i, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            errors.append(f"{context} scene[{i}]: expected an object, got {type(scene).__name__}")
            continue
        scene_id = scene.get("scene_id", f"scene[{i}]")
        loc = f"{context} scene {scene_id}"

        # Rule 6: required scene keys
        for key in ("scene_id", "duration_ms", "narration", "animation", "canvas_state"):
            if key not in scene:
                errors.append(f"{loc}: missing required key '{key}'")
        narration = _as_dict(scene.get("narration")) if "narration" in scene else None
        if narration is not None and "text" not in narration:
            errors.append(f"{loc}: narration missing 'text'")
        if "animation" not in scene:
            continue
        anim = _as_dict(scene["animation"])
        if not anim or "type" not in anim:
            errors.append(f"{loc}: animation missing 'type'")
            continue

        atype = anim.get("type", "")

        # Rule 5: allowed types
        if atype not in ALLOWED_ANIMATION_TYPES:
            errors.append(f"{loc}: unknown animation type '{atype}'")

        # Rule 7: narration sentence length
        if narration and isinstance(narration.get("text"), str):
            text = narration["text"]
            sentences = _count_sentences(text)
            if len(sentences) > 2:
                errors.append(f"{loc}: narration has {len(sentences)} sentences (max 2)")
            for sent in sentences:
                word_count = len(sent.split())
                if word_count > 35:
                    errors.append(
                        f"{loc}: narration sentence exceeds 35 words ({word_count} words): '{sent[:60]}...'"
                    )

        # Rule 2: appear_character position bounds
        if atype == "appear_character":
            char_id = anim.get("id")
            if char_id:
                introduced.add(char_id)
            pos = _as_dict(anim.get("position", {}))
            for axis in ("x", "y"):
                val = pos.get(axis)
                if val is None:
                    errors.append(f"{loc}: appear_character missing position.{axis}")
                elif not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 1.0):
                    errors.append(
                        f"{loc}: appear_character position.{axis}={val} not in [0.0, 1.0]"
                    )

        # Rule 1: character references must have been introduced
        elif atype == "draw_connection":
            for field in ("from", "to"):
                ref_id = anim.get(field)
                if ref_id and ref_id not in introduced:
                    errors.append(
                        f"{loc}: draw_connection '{field}' references unknown character '{ref_id}'"
                    )
        elif atype == "highlight_character":
            ref_id = anim.get("id")
            if ref_id and ref_id not in introduced:
                errors.append(
                    f"{loc}: highlight_character references unknown character '{ref_id}'"
                )
        elif atype == "zoom_to":
            ref_id = anim.get("target_id")
            if ref_id and ref_id not in introduced:
                errors.append(
                    f"{loc}: zoom_to references unknown character '{ref_id}'"
                )
        elif atype == "spotlight":
            ref_id = anim.get("target_id")
            if ref_id and ref_id not in introduced:
                errors.append(
                    f"{loc}: spotlight references unknown character '{ref_id}'"
                )
        # animate_flow: connection_id is NOT a character id — skip check


def validate_script(script: dict, repo_story: dict) -> list[str]:
    """Returns list of error strings. Empty list means valid."""
    errors: list[str] = []

    valid_char_ids = {c["id"] for c in repo_story.get("characters", []) if isinstance(c, dict) and "id" in c}

    overview = _as_dict(script.get("overview", {}))
    scenes = overview.get("scenes", [])
    if not isinstance(scenes, list):
        scenes = []

    # Rule 3: total_duration_ms == sum of scene durations
    computed_total = sum(s.get("duration_ms", 0) for s in scenes)
    declared_total = overview.get("total_duration_ms", None)
    if declared_total is None:
        errors.append("overview: missing total_duration_ms")
    elif declared_total != computed_total:
        errors.append(
            f"overview: total_duration_ms={declared_total} != sum of scene durations={computed_total}"
        )

    # Check overview scenes (independent introduced set)
    overview_introduced: set[str] = set()
    _check_scenes(scenes, overview_introduced, "overview", errors)

    # Check components
    components = script.get("components", [])
    if not isinstance(components, list):
        components = []
    for comp in components:
        if not isinstance(comp, dict):
            errors.append(f"component: expected an object, got {type(comp).__name__}")
            continue
        char_id = comp.get("character_id")

        # Rule 4: character_id must exist in repo_story characters
        if char_id and char_id not in valid_char_ids:
            errors.append(
                f"component: character_id '{char_id}' not in repo_story characters"
            )

        # Each component deep_dive has its own independent introduced set
        deep_dive = _as_dict(comp.get("deep_dive", {}))
        dd_scenes = deep_dive.get("scenes", [])
        if not isinstance(dd_scenes, list):
            dd_scenes = []
        dd_introduced: set[str] = set()
        _check_scenes(dd_scenes, dd_introduced, f"component[{char_id}] deep_dive", errors)

    return errors


def safe_default_script(repo_story: dict) -> dict:
    """
    Deterministically builds a minimal valid script from repo_story. Zero LLM calls.
    Uses only fade_in_title, appear_character, draw_connection.
    Guaranteed to pass validate_script with an empty error list.
    """
    repo_identity = repo_story.get("repo_identity", {})
    repo_name = repo_identity.get("name", "Repository")
    one_line = repo_identity.get("one_line", "An interesting codebase.")

    characters = repo_story.get("characters", [])[:6]

    scenes = []
    scene_counter = [0]

    def next_scene_id() -> str:
        scene_counter[0] += 1
        return f"s{scene_counter[0]}"

    # Scene 1: fade_in_title
    title_scene = {
        "scene_id": next_scene_id(),
        "duration_ms": 4000,
        "narration": {
            "text": f"Welcome to {repo_name}. {one_line}",
            "delivery": "calm",
            "pause_before_ms": 0,
        },
        "animation": {
            "type": "fade_in_title",
            "title": repo_name,
            "subtitle": one_line,
        },
        "canvas_state": "Title card visible",
    }
    scenes.append(title_scene)

    # Scenes 2-N: one appear_character per character, positions spread evenly
    n_chars = len(characters)
    for i, char in enumerate(characters):
        if n_chars > 1:
            x = round((i + 1) / (n_chars + 1), 2)
        else:
            x = 0.5
        y = 0.5

        char_scene = {
            "scene_id": next_scene_id(),
            "duration_ms": 3000,
            "narration": {
                "text": f"Meet {char.get('name', char['id'])}. {' '.join(char.get('role', '').split()[:20])}".strip(),
                "delivery": "calm",
                "pause_before_ms": 0,
            },
            "animation": {
                "type": "appear_character",
                "id": char["id"],
                "label": char.get("name", char["id"]),
                "icon": "server",
                "position": {"x": x, "y": y},
                "color": "blue",
            },
            "canvas_state": f"{char.get('name', char['id'])} visible",
        }
        scenes.append(char_scene)

    # Connection scenes: draw_connection for characters with relationships
    # Track introduced character ids (in order they appear in scenes)
    introduced_order = [c["id"] for c in characters]
    added_connections: set[tuple[str, str]] = set()

    for char in characters:
        for rel in char.get("relationships", []):
            other_id = rel.get("with")
            if not other_id:
                continue
            if other_id not in introduced_order:
                continue
            # Both must be in characters list
            pair = tuple(sorted([char["id"], other_id]))
            if pair in added_connections:
                continue
            # Both must appear before this scene (they're all appear_character scenes already)
            added_connections.add(pair)
            nature = rel.get("nature", "connected")
            nature_snippet = ' '.join(nature.split()[:20])

            conn_scene = {
                "scene_id": next_scene_id(),
                "duration_ms": 2500,
                "narration": {
                    "text": f"{char.get('name', char['id'])} and {other_id} work together. {nature_snippet}".strip(),
                    "delivery": "calm",
                    "pause_before_ms": 0,
                },
                "animation": {
                    "type": "draw_connection",
                    "from": char["id"],
                    "to": other_id,
                    "label": nature[:40] if nature else "connected",
                    "style": "solid",
                    "direction": "two_way",
                },
                "canvas_state": f"Connection between {char['id']} and {other_id} visible",
            }
            scenes.append(conn_scene)

    # Compute exact total duration
    total_duration_ms = sum(s["duration_ms"] for s in scenes)

    # Build components: one per character with empty deep_dive
    components = []
    for i, char in enumerate(characters):
        if len(characters) > 1:
            x = round((i + 1) / (len(characters) + 1), 2)
        else:
            x = 0.5
        components.append({
            "character_id": char["id"],
            "click_target": {
                "label": char.get("name", char["id"]),
                "position": {"x": x, "y": 0.5},
            },
            "deep_dive": {
                "scenes": [],
            },
        })

    return {
        "overview": {
            "total_duration_ms": total_duration_ms,
            "scenes": scenes,
        },
        "components": components,
    }
