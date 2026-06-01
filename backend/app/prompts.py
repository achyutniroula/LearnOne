TUTOR_PROMPT = (
    "You are LEON, a Jarvis-style AI educator and personal tutor.\n"
    "You are teaching {user_email} whose goal is: {learning_goal}.\n\n"
    "Teaching principles:\n"
    "- Adjust complexity to the learner's demonstrated level.\n"
    "- Use concrete analogies and real-world examples.\n"
    "- End every response with a follow-up question or comprehension check.\n"
    "- Use markdown: headers, bullet points, code blocks where appropriate.\n"
    "- If the learner asks something off-topic, gently redirect to the learning goal.\n"
    "{curriculum}{memory}"
)

ASSISTANT_PROMPT = (
    "You are LEON, an intelligent AI assistant with deep reasoning capabilities.\n"
    "You are helping {user_email}.\n"
    "Be concise, direct, and genuinely helpful. Think carefully before answering.\n"
    "Use markdown formatting where it adds clarity.\n"
    "{memory}"
)


def build_system_prompt(user_email: str, learning_goal: str,
                        curriculum_json: str | None = None,
                        memory_block: str = "",
                        last_session_context: str = "") -> str:
    memory = (memory_block or "") + (last_session_context or "")
    if learning_goal == "LEON Voice":
        return ASSISTANT_PROMPT.format(user_email=user_email, memory=memory)
    curriculum = f"\n\nCurrent curriculum:\n{curriculum_json}" if curriculum_json else ""
    return TUTOR_PROMPT.format(
        user_email=user_email,
        learning_goal=learning_goal,
        curriculum=curriculum,
        memory=memory,
    )


def build_curriculum_prompt(learning_goal: str) -> str:
    return (
        f'Generate a step-by-step learning curriculum for the following goal: "{learning_goal}"\n\n'
        "Return ONLY a valid JSON object in this exact format (no markdown, no explanation):\n"
        '{"title": "short curriculum title", "phases": [{"name": "Phase name", "topics": ["topic1", "topic2"]}]}'
    )


def build_summary_prompt(conversation_text: str) -> str:
    return (
        "Summarize the following learning conversation into 3-5 bullet points.\n"
        "Capture the key concepts explained, questions asked, and progress made.\n"
        "Be concise — this summary will be used as context for future messages.\n\n"
        f"Conversation:\n{conversation_text}"
    )


def build_extraction_prompt(user_message: str, assistant_reply: str, existing_keys: list[str]) -> str:
    existing = ", ".join(existing_keys) if existing_keys else "none"
    return (
        f"Analyze this learning exchange and extract insights.\n\n"
        f"Existing memory keys (update these instead of creating duplicates): {existing}\n\n"
        f"Exchange:\nUser: {user_message}\nAssistant: {assistant_reply}\n\n"
        "Return ONLY valid JSON (no markdown, no prose):\n"
        '{"memories": [{"key": "short-kebab-case-key", "category": "struggle|style|background|misconception|preference", '
        '"value": "concise fact about learner", "confidence": 70}], '
        '"concepts": [{"label": "Concept Label", "mastery": 65}]}\n'
        "Both arrays may be empty if nothing meaningful to extract."
    )
