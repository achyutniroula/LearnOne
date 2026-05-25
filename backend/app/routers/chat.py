import json
import re
import threading
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..models import User, LearningSession, ChatMessage, Curriculum, UserMemory, KnowledgeNode, ConceptReview
from ..auth import get_current_user
from ..schemas import ChatRequest, ChatResponse
from ..claude import run_claude, build_messages_prompt
from ..redis_client import rate_limit_check
from ..prompts import build_system_prompt, build_summary_prompt, build_extraction_prompt

router = APIRouter(prefix="/api/sessions", tags=["chat"])

CONTEXT_LIMIT = 20
VISUAL_RE = re.compile(r"\b(diagram|visuali[sz]e?|chart|graph|draw|show me|visually|flowchart|sequence|mindmap)\b", re.I)
MAX_MEMORIES = 50


@router.post("/{session_id}/chat", response_model=ChatResponse)
def chat(session_id: int, req: ChatRequest, db: Session = Depends(get_db),
         current_user: User = Depends(get_current_user)):
    if not rate_limit_check(current_user.id):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Rate limit exceeded: max 30 messages per hour")

    session = _get_session_or_404(session_id, current_user.id, db)

    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="USER",
                           content=req.message, image_data=req.imageData,
                           image_media_type=req.imageMediaType)
    db.add(user_msg)
    db.commit()

    history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id,
        ChatMessage.role != "SYSTEM"
    ).order_by(ChatMessage.created_at.asc()).all()

    claude_history = _build_history(history, db)

    curriculum = db.query(Curriculum).filter(Curriculum.session_id == session_id).first()
    curriculum_json = curriculum.content if curriculum else None

    memory_block = _build_memory_block(current_user.id, db)
    last_ctx = _last_session_context(current_user.id, session_id, db)
    system_prompt = build_system_prompt(current_user.email, session.learning_goal,
                                        curriculum_json, memory_block, last_ctx)

    full_prompt = build_messages_prompt(claude_history, system_prompt)
    reply = run_claude(full_prompt)

    assistant_msg = ChatMessage(session_id=session_id, role="ASSISTANT", content=reply)
    db.add(assistant_msg)
    db.commit()

    diagram_code = None
    if VISUAL_RE.search(req.message):
        diagram_code = _generate_diagram(reply)

    threading.Thread(target=_extract_async, args=(current_user.id, session_id, req.message, reply),
                     daemon=True).start()

    return ChatResponse(role="assistant", content=reply, diagramCode=diagram_code)


def _get_session_or_404(session_id: int, user_id: int, db: Session) -> LearningSession:
    s = db.query(LearningSession).filter(
        LearningSession.id == session_id, LearningSession.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def _build_history(history: list[ChatMessage], db: Session) -> list[dict]:
    if len(history) <= CONTEXT_LIMIT:
        return [{"role": m.role.lower(), "content": m.content} for m in history]

    old = history[:-CONTEXT_LIMIT]
    recent = history[-CONTEXT_LIMIT:]
    old_text = "\n".join(f"{m.role}: {m.content}" for m in old)
    summary = run_claude(build_summary_prompt(old_text))
    result = [
        {"role": "user", "content": f"[Earlier conversation summary]\n{summary}"},
        {"role": "assistant", "content": "Understood. I'll continue from where we left off."},
    ]
    result += [{"role": m.role.lower(), "content": m.content} for m in recent]
    return result


def _build_memory_block(user_id: int, db: Session) -> str:
    memories = db.query(UserMemory).filter(UserMemory.user_id == user_id).order_by(
        UserMemory.confidence.desc(), UserMemory.updated_at.desc()).limit(10).all()
    nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).order_by(
        KnowledgeNode.mastery.desc()).limit(15).all()
    if not memories and not nodes:
        return ""
    sb = []
    if memories:
        sb.append("\n\nLearner profile:")
        for m in memories:
            val = m.value[:120] + "…" if len(m.value) > 120 else m.value
            sb.append(f"\n- [{m.category}] {val} ({m.confidence}% confidence)")
    if nodes:
        sb.append("\n\nConcept mastery:")
        for n in nodes:
            s = "" if n.exposures == 1 else "s"
            sb.append(f"\n- {n.concept_label}: {n.mastery}/100 ({n.exposures} exposure{s})")
    return "".join(sb)


def _last_session_context(user_id: int, current_session_id: int, db: Session) -> str:
    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == user_id
    ).order_by(LearningSession.created_at.desc()).limit(2).all()
    for s in sessions:
        if s.id != current_session_id:
            return f"\n\nPrevious session: {s.learning_goal} — build on that context."
    return ""


def _generate_diagram(reply: str) -> str | None:
    prompt = (
        f"Based on this teaching response:\n\n{reply}\n\n"
        "Generate a Mermaid.js diagram visualizing the key concept.\n"
        "Output ONLY the raw Mermaid code (e.g. starting with 'graph TD', 'flowchart LR', etc.).\n"
        "No markdown fences. No explanation."
    )
    try:
        return run_claude(prompt).strip()
    except Exception:
        return None


def _extract_async(user_id: int, session_id: int, user_message: str, assistant_reply: str):
    db = SessionLocal()
    try:
        existing_keys = [m.key for m in db.query(UserMemory).filter(
            UserMemory.user_id == user_id).order_by(
            UserMemory.confidence.desc(), UserMemory.updated_at.desc()).limit(10).all()]

        prompt = build_extraction_prompt(user_message, assistant_reply, existing_keys)
        raw = run_claude(prompt)
        data = _parse_json(raw)
        if not data:
            return

        for m in data.get("memories", []):
            key = (m.get("key") or "").strip()
            value = (m.get("value") or "").strip()
            category = (m.get("category") or "general").strip()
            confidence = max(0, min(100, int(m.get("confidence", 50))))
            if not key or not value:
                continue
            memory = db.query(UserMemory).filter(
                UserMemory.user_id == user_id, UserMemory.key == key).first()
            if memory:
                memory.value = value
                memory.category = category
                memory.confidence = max(memory.confidence, confidence)
                memory.source_session_id = session_id
            else:
                memory = UserMemory(user_id=user_id, key=key, value=value,
                                    category=category, confidence=confidence,
                                    source_session_id=session_id)
                db.add(memory)
            db.flush()
            if db.query(UserMemory).filter(UserMemory.user_id == user_id).count() > MAX_MEMORIES:
                oldest = db.query(UserMemory).filter(UserMemory.user_id == user_id).order_by(
                    UserMemory.confidence.asc(), UserMemory.updated_at.asc()).first()
                if oldest:
                    db.delete(oldest)

        for c in data.get("concepts", []):
            label = (c.get("label") or "").strip()
            incoming = max(0, min(100, int(c.get("mastery", 0))))
            if not label:
                continue
            slug = re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", label.lower()))
            if not slug:
                continue
            node = db.query(KnowledgeNode).filter(
                KnowledgeNode.user_id == user_id, KnowledgeNode.concept_slug == slug).first()
            if node:
                updated = round(0.6 * node.mastery + 0.4 * incoming)
                node.mastery = max(0, min(100, updated))
                node.exposures += 1
                node.last_session_id = session_id
            else:
                node = KnowledgeNode(user_id=user_id, concept_slug=slug, concept_label=label,
                                     mastery=0, exposures=1, last_session_id=session_id)
                db.add(node)
            db.flush()
            # Init spaced repetition if absent
            if not db.query(ConceptReview).filter(
                    ConceptReview.user_id == user_id, ConceptReview.concept_slug == slug).first():
                db.add(ConceptReview(user_id=user_id, concept_slug=slug, concept_label=label))

        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _parse_json(raw: str) -> dict | None:
    text = raw.strip()
    if text.startswith("```"):
        start = text.find("\n") + 1
        end = text.rfind("```")
        if end > start:
            text = text[start:end].strip()
    try:
        return json.loads(text)
    except Exception:
        return None
