import logging
import re
import threading
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, LearningSession, ChatMessage, Curriculum, IndexedRepo
from ..auth import get_current_user
from ..schemas import CreateSessionRequest, SessionResponse, MessageResponse
from ..claude import run_claude
from ..prompts import build_curriculum_prompt

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
logger = logging.getLogger(__name__)

_GITHUB_RE = re.compile(r'github\.com/([^/]+/[^/?#]+?)(?:\.git)?(?:[/?#].*)?$')


def _extract_repo_name(repo_url: str) -> str:
    m = _GITHUB_RE.search(repo_url)
    return m.group(1) if m else repo_url


def _generate_curriculum_async(session_id: int, repo_info: str, db_factory):
    def task():
        db = db_factory()
        try:
            prompt = build_curriculum_prompt(repo_info)
            content = run_claude(prompt)
            curriculum = Curriculum(session_id=session_id, content=content)
            db.add(curriculum)
            db.commit()
        except Exception:
            logger.exception("Curriculum generation failed for session_id=%s", session_id)
        finally:
            db.close()
    threading.Thread(target=task, daemon=True).start()


def _find_or_create_indexed_repo(repo_url: str, db: Session) -> IndexedRepo:
    """
    Find an existing IndexedRepo by URL, or create one and kick off indexing.
    Normalises the URL to https://github.com/owner/repo canonical form.
    """
    from ..services.indexer import run_indexing_pipeline

    m = _GITHUB_RE.search(repo_url)
    if not m:
        raise HTTPException(status_code=400, detail="Not a valid GitHub repository URL")
    owner, repo_name = m.group(1).split('/', 1)
    canonical = f"https://github.com/{owner}/{repo_name}"

    row = db.query(IndexedRepo).filter(IndexedRepo.repo_url == canonical).first()
    if row:
        # Re-trigger indexing only if previously failed
        if row.status == 'failed':
            row.status = 'pending'
            row.error_message = None
            row.file_count = None
            row.chunk_count = None
            row.indexed_at = None
            db.commit()
            threading.Thread(
                target=run_indexing_pipeline, args=(row.id, canonical), daemon=True
            ).start()
        return row

    row = IndexedRepo(
        repo_url=canonical, owner=owner, repo_name=repo_name,
        default_branch='main', status='pending',
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    threading.Thread(
        target=run_indexing_pipeline, args=(row.id, canonical), daemon=True
    ).start()
    return row


@router.post("", response_model=SessionResponse, status_code=201)
def create_session(
    req: CreateSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.repoUrl and req.repoId is None:
        raise HTTPException(status_code=400, detail="Provide repoUrl or repoId")

    indexed_repo: IndexedRepo | None = None

    if req.repoId is not None:
        indexed_repo = db.get(IndexedRepo, req.repoId)
        if not indexed_repo:
            raise HTTPException(status_code=404, detail="Indexed repo not found")
        repo_url = indexed_repo.repo_url
        repo_name = f"{indexed_repo.owner}/{indexed_repo.repo_name}"
    elif req.repoUrl == "LEON Voice":
        # Sentinel for auto-created voice sessions — no repo indexing
        repo_url = "LEON Voice"
        repo_name = "LEON Voice"
    else:
        indexed_repo = _find_or_create_indexed_repo(req.repoUrl, db)
        repo_url = indexed_repo.repo_url
        repo_name = f"{indexed_repo.owner}/{indexed_repo.repo_name}"

    session = LearningSession(
        user_id=current_user.id,
        learning_goal=repo_name,
        repo_url=repo_url,
        repo_id=indexed_repo.id if indexed_repo else None,
        title=repo_name,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Generate repo overview asynchronously (curriculum panel)
    if repo_url != "LEON Voice":
        from ..database import SessionLocal
        _generate_curriculum_async(session.id, repo_url, SessionLocal)

    # Auto-trigger scriptwriter if story is already ready
    if indexed_repo is not None:
        from ..models import RepoStory
        story = db.query(RepoStory).filter(
            RepoStory.repo_id == indexed_repo.id
        ).first()
        if story and story.status == "ready":
            import threading as _threading
            from ..services.script_writer import run_script_generation
            _threading.Thread(
                target=run_script_generation, args=(session.id,), daemon=True
            ).start()

    repo_status = indexed_repo.status if indexed_repo else None
    return _to_session_response(session, repo_status=repo_status)


@router.get("", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == current_user.id
    ).order_by(LearningSession.created_at.desc()).all()
    return [_to_session_response(s) for s in sessions]


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
def get_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_session_or_404(session_id, current_user.id, db)
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [_to_message_response(m) for m in messages]


@router.get("/{session_id}/curriculum")
def get_curriculum(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


def _to_session_response(
    s: LearningSession, repo_status: str | None = None
) -> SessionResponse:
    return SessionResponse(
        id=s.id,
        title=s.title,
        learningGoal=s.learning_goal,
        repoUrl=s.repo_url,
        repoId=s.repo_id,
        repoStatus=repo_status,
        status=s.status,
        createdAt=s.created_at,
    )


def _to_message_response(m: ChatMessage) -> MessageResponse:
    return MessageResponse(
        id=m.id, role=m.role, content=m.content,
        imageData=m.image_data, imageMediaType=m.image_media_type,
        createdAt=m.created_at,
    )
