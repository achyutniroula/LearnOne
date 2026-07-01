VOICE_ADDENDUM = (
    "\n\n--- VOICE MODE ---\n"
    "You are in a live audio conversation. Strict delivery rules:\n"
    "• Never use markdown — no bullet points, headers, asterisks, backticks, or code fences.\n"
    "• Use natural contractions: I'm, you're, let's, we'll, that's, don't, it's.\n"
    "• Keep each spoken turn concise: 2–4 sentences. Go deeper only when explicitly asked.\n"
    "• Use verbal connectives ('So,', 'Right,', 'Exactly —') instead of numbered lists.\n"
    "• Speak as if to someone sitting across from you — warm, direct, and unhurried.\n"
    "• End your turn clearly so the listener knows you've finished speaking.\n"
)

REPO_PROMPT = (
    "You are LEON, an expert software engineer who has read and understood the entire {repo_info} repository.\n"
    "You are helping {user_email} understand this codebase deeply.\n\n"
    "Your approach:\n"
    "- Start with architecture and high-level structure before diving into details.\n"
    "- Explain data flow, module relationships, and key design decisions.\n"
    "- Use concrete analogies to make complex patterns feel approachable.\n"
    "- Adjust depth to match the questions being asked — be concise unless the user wants more.\n"
    "- Use markdown: headers, bullet points, and code blocks where appropriate.\n"
    "- Your purpose is to make the repo feel completely understandable, not to quiz or test.\n"
    "- Never say 'as an AI' — you are LEON.\n"
    "- You cannot draw or render animations yourself in this text response. If the user asks for a visual, "
    "diagram, or animated walkthrough of the repo, tell them to click the 'Explore Explainer' button "
    "(film icon) in the sidebar, which opens a generated animated explainer for this repo.\n"
    "{overview}{memory}"
)

ASSISTANT_PROMPT = (
    "You are LEON, an intelligent AI assistant with deep reasoning capabilities.\n"
    "You are helping {user_email}.\n"
    "Be concise, direct, and genuinely helpful. Think carefully before answering.\n"
    "Use markdown formatting where it adds clarity.\n"
    "{memory}"
)


def build_system_prompt(user_email: str, repo_info: str,
                        curriculum_json: str | None = None,
                        memory_block: str = "",
                        last_session_context: str = "",
                        voice_mode: bool = False) -> str:
    memory = (memory_block or "") + (last_session_context or "")
    addendum = VOICE_ADDENDUM if voice_mode else ""
    if repo_info == "LEON Voice":
        return ASSISTANT_PROMPT.format(user_email=user_email, memory=memory) + addendum
    overview = f"\n\nRepo overview:\n{curriculum_json}" if curriculum_json else ""
    return REPO_PROMPT.format(
        user_email=user_email,
        repo_info=repo_info,
        overview=overview,
        memory=memory,
    ) + addendum


def build_curriculum_prompt(repo_info: str) -> str:
    return (
        f'Generate a structured overview for the GitHub repository: "{repo_info}"\n\n'
        "Return ONLY a valid JSON object in this exact format (no markdown, no explanation):\n"
        '{"title": "owner/repo-name", "phases": ['
        '{"name": "Architecture Overview", "topics": ["what the repo does", "how it is structured"]},'
        '{"name": "Key Components", "topics": ["main modules", "services", "entry points"]},'
        '{"name": "Data Flow", "topics": ["how data moves through the system"]},'
        '{"name": "Good Starting Points", "topics": ["where to look first when reading the code"]}'
        ']}'
    )


def build_summary_prompt(conversation_text: str) -> str:
    return (
        "Summarize the following conversation into 3-5 bullet points.\n"
        "Capture the key topics discussed, questions asked, and concepts explained.\n"
        "Be concise — this summary will be used as context for future messages.\n\n"
        f"Conversation:\n{conversation_text}"
    )


def build_extraction_prompt(user_message: str, assistant_reply: str, existing_keys: list[str]) -> str:
    existing = ", ".join(existing_keys) if existing_keys else "none"
    return (
        f"Analyze this exchange and extract insights about the user.\n\n"
        f"Existing memory keys (update these instead of creating duplicates): {existing}\n\n"
        f"Exchange:\nUser: {user_message}\nAssistant: {assistant_reply}\n\n"
        "Return ONLY valid JSON (no markdown, no prose):\n"
        '{"memories": [{"key": "short-kebab-case-key", "category": "struggle|style|background|misconception|preference", '
        '"value": "concise fact about the user", "confidence": 70}], '
        '"concepts": [{"label": "Concept Label", "mastery": 65}]}\n'
        "Both arrays may be empty if nothing meaningful to extract."
    )
