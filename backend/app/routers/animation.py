"""Animation script endpoints — generate, poll status, fetch script."""
import threading
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, LearningSession, RepoStory, AnimationScript
from ..auth import get_current_user
from ..services.script_writer import run_script_generation

router = APIRouter(prefix="/api/sessions/{session_id}/animation", tags=["animation"])


def _get_session_or_404(session_id: int, current_user: User, db: Session) -> LearningSession:
    session = db.query(LearningSession).filter(
        LearningSession.id == session_id,
        LearningSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/generate")
def generate_animation(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(session_id, current_user, db)

    # Check story readiness
    repo_id = session.repo_id
    if not repo_id:
        raise HTTPException(status_code=400, detail="Session has no associated repo")

    story = db.query(RepoStory).filter(RepoStory.repo_id == repo_id).first()
    if not story or story.status != "ready":
        return JSONResponse(status_code=202, content={"status": "story_pending"})

    # Upsert AnimationScript row to pending
    existing = db.query(AnimationScript).filter(
        AnimationScript.session_id == session_id
    ).first()
    if existing:
        existing.status = "pending"
        existing.error = None
        db.commit()
    else:
        row = AnimationScript(
            session_id=session_id,
            repo_id=repo_id,
            script={},
            status="pending",
        )
        db.add(row)
        db.commit()

    # Launch background generation
    threading.Thread(
        target=run_script_generation, args=(session_id,), daemon=True
    ).start()

    return {"status": "pending"}


@router.get("/status")
def get_animation_status(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_session_or_404(session_id, current_user, db)

    row = db.query(AnimationScript).filter(
        AnimationScript.session_id == session_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="No animation script found for this session")

    return {"status": row.status, "error": row.error}


@router.get("/script")
def get_animation_script(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_session_or_404(session_id, current_user, db)

    row = db.query(AnimationScript).filter(
        AnimationScript.session_id == session_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="No animation script found for this session")
    if row.status != "ready":
        raise HTTPException(status_code=409, detail="Script not ready")

    return JSONResponse(content=row.script)
