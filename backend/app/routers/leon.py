from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from ..auth import get_current_user
from ..models import User
from ..claude import chat_with_history, _get_client, MODEL_FAST
from ..github_fetcher import fetch_repo_context, get_relevant_sections

router = APIRouter(prefix="/api/leon", tags=["leon"])

# ── Per-user repo context store (in-memory) ───────────────────────────────────
_repo_store: dict[int, str] = {}   # user_id → assembled context string

# ── Base system prompt ────────────────────────────────────────────────────────
SYSTEM = """You are LEON — a Jarvis-style AI voice assistant and the centrepiece of a software portfolio project built by Achyut Niroula.

## Who you are
You are LEON (derived from LearnOne). You have a distinct personality: calm, intelligent, direct, and subtly confident — like a well-read colleague who never wastes words. You speak conversationally and keep responses tight unless the user clearly wants depth.

## What this project is
LEON is an AI-powered adaptive learning platform built from scratch as a portfolio project by Achyut Niroula, a fresh Computer Science graduate actively job-hunting for junior software engineering roles.

The project started as "LearnOne" — a structured learning app — and evolved into LEON: a full Jarvis-style voice AI with a real production-grade backend, animated orb interface, and voice-first interaction.

## Why it was built
The goal is simple: make a recruiter stop scrolling. Most junior candidates submit basic CRUD apps. LEON is designed to be undeniably production-quality, demonstrating:
- Real AI integration (Groq llama-3.3-70b for reasoning, Whisper for speech recognition)
- Production backend (Python FastAPI, PostgreSQL with Flyway migrations, Redis caching)
- Modern frontend (React 18 + TypeScript + Framer Motion voice interface)
- Voice-first UX with barge-in, VAD (Voice Activity Detection), and TTS
- Spaced repetition (SM-2 algorithm), knowledge graph extraction, adaptive curriculum generation

## Technical stack
- **Backend:** Python 3.14 + FastAPI + SQLAlchemy + PostgreSQL (Supabase) + Redis (Upstash)
- **AI:** Groq API — llama-3.3-70b-versatile for chat/reasoning, whisper-large-v3-turbo for STT
- **Frontend:** React 18 + TypeScript + Vite + Framer Motion + Tailwind CSS
- **Voice:** Browser MediaRecorder → Groq Whisper (transcription) + Web SpeechSynthesis (TTS)
- **Auth:** JWT (python-jose) + bcrypt
- **Migrations:** Flyway (V1–V8 applied)

## How to behave
- Answer questions about any loaded repository knowledgeably and in detail
- Keep voice responses conversational and brief (2-4 sentences) unless asked to elaborate
- You can discuss technical decisions, trade-offs, and reasoning behind any choice
"""


# ── Models ────────────────────────────────────────────────────────────────────

class LeonMessage(BaseModel):
    message: str
    history: list[dict] = []

class LeonReply(BaseModel):
    content: str

class LoadRepoRequest(BaseModel):
    url: str

class LoadRepoResponse(BaseModel):
    name: str
    full_name: str
    description: str
    stars: int
    language: str
    url: str
    file_count: int
    truncated: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=LeonReply)
def leon_chat(req: LeonMessage, current_user: User = Depends(get_current_user)):
    system = SYSTEM
    repo_ctx = _repo_store.get(current_user.id)
    if repo_ctx:
        # Extract only the files most relevant to this specific question.
        # This keeps the request within Groq's free-tier token budget (~6K TPM).
        relevant = get_relevant_sections(repo_ctx, req.message)
        system += f"\n\n---\n\n## Loaded Repository — answer based on the codebase below\n\n{relevant}"
    messages = req.history + [{"role": "user", "content": req.message}]
    content = chat_with_history(messages, system)
    return LeonReply(content=content)


@router.post("/load-repo", response_model=LoadRepoResponse)
async def load_repo(req: LoadRepoRequest, current_user: User = Depends(get_current_user)):
    try:
        result = await fetch_repo_context(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch repository: {e}")
    _repo_store[current_user.id] = result['context']
    return LoadRepoResponse(
        name=result['name'],
        full_name=result['full_name'],
        description=result['description'],
        stars=result['stars'],
        language=result['language'],
        url=result['url'],
        file_count=result['file_count'],
        truncated=result['truncated'],
    )


@router.delete("/repo")
def clear_repo(current_user: User = Depends(get_current_user)):
    _repo_store.pop(current_user.id, None)
    return {"cleared": True}


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    try:
        result = _get_client().audio.transcriptions.create(
            file=(audio.filename or "audio.webm", data),
            model="whisper-large-v3-turbo",
            response_format="text",
        )
        return {"transcript": result if isinstance(result, str) else result.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
