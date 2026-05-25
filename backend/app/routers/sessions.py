import threading
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, LearningSession, ChatMessage, Curriculum
from ..auth import get_current_user
from ..schemas import CreateSessionRequest, SessionResponse, MessageResponse
from ..claude import run_claude
from ..prompts import build_curriculum_prompt

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _generate_curriculum_async(session_id: int, learning_goal: str, db_factory):
    def task():
        db = db_factory()
        try:
            prompt = build_curriculum_prompt(learning_goal)
            content = run_claude(prompt)
            curriculum = Curriculum(session_id=session_id, content=content)
            db.add(curriculum)
            db.commit()
        except Exception:
            pass
        finally:
            db.close()
    threading.Thread(target=task, daemon=True).start()


@router.post("", response_model=SessionResponse, status_code=201)
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    title = req.learningGoal[:79] + "…" if len(req.learningGoal) > 80 else req.learningGoal
    session = LearningSession(user_id=current_user.id, learning_goal=req.learningGoal, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    from ..database import SessionLocal
    _generate_curriculum_async(session.id, req.learningGoal, SessionLocal)
    return _to_session_response(session)


@router.get("", response_model=list[SessionResponse])
def list_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == current_user.id
    ).order_by(LearningSession.created_at.desc()).all()
    return [_to_session_response(s) for s in sessions]


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
def get_messages(session_id: int, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    _get_session_or_404(session_id, current_user.id, db)
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [_to_message_response(m) for m in messages]


@router.get("/{session_id}/curriculum")
def get_curriculum(session_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    _get_session_or_404(session_id, current_user.id, db)
    curriculum = db.query(Curriculum).filter(Curriculum.session_id == session_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not ready yet")
    return JSONResponse(content=curriculum.content, media_type="application/json")


def _get_session_or_404(session_id: int, user_id: int, db: Session) -> LearningSession:
    session = db.query(LearningSession).filter(
        LearningSession.id == session_id, LearningSession.user_id == user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _to_session_response(s: LearningSession) -> SessionResponse:
    return SessionResponse(id=s.id, title=s.title, learningGoal=s.learning_goal,
                           status=s.status, createdAt=s.created_at)


def _to_message_response(m: ChatMessage) -> MessageResponse:
    return MessageResponse(id=m.id, role=m.role, content=m.content,
                           imageData=m.image_data, imageMediaType=m.image_media_type,
                           createdAt=m.created_at)
