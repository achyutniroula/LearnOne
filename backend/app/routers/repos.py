import threading
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, IndexedRepo
from ..auth import get_current_user
from ..schemas import IndexRepoRequest, IndexedRepoStatusResponse, IndexedRepoSummary
from ..services.indexer import run_indexing_pipeline

router = APIRouter(prefix="/api/repos", tags=["repos"])

_GITHUB_RE = re.compile(r'github\.com/([^/]+/[^/?#]+?)(?:\.git)?(?:[/?#].*)?$')


def _parse_github_url(url: str) -> tuple[str, str]:
    m = _GITHUB_RE.search(url)
    if not m:
        raise ValueError("Not a valid GitHub repository URL")
    owner, repo = m.group(1).split('/', 1)
    return owner, repo


def _start_indexing(repo_id: int, repo_url: str) -> None:
    threading.Thread(
        target=run_indexing_pipeline,
        args=(repo_id, repo_url),
        daemon=True,
    ).start()


@router.post("/index", response_model=IndexedRepoStatusResponse, status_code=202)
def index_repo(
    req: IndexRepoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        owner, repo_name = _parse_github_url(req.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Normalise URL to canonical form
    canonical_url = f"https://github.com/{owner}/{repo_name}"

    existing = db.query(IndexedRepo).filter(IndexedRepo.repo_url == canonical_url).first()

    if existing:
        if existing.status in ('pending', 'fetching', 'indexing'):
            # Already in progress — return current state
            return IndexedRepoStatusResponse(
                repoId=existing.id,
                status=existing.status,
                fileCount=existing.file_count,
                chunkCount=existing.chunk_count,
            )
        if existing.status == 'ready':
            return IndexedRepoStatusResponse(
                repoId=existing.id,
                status='ready',
                fileCount=existing.file_count,
                chunkCount=existing.chunk_count,
            )
        # status == 'failed' — reset and re-index
        existing.status = 'pending'
        existing.error_message = None
        existing.file_count = None
        existing.chunk_count = None
        existing.indexed_at = None
        db.commit()
        _start_indexing(existing.id, canonical_url)
        return IndexedRepoStatusResponse(repoId=existing.id, status='pending')

    # New repo
    row = IndexedRepo(
        repo_url=canonical_url,
        owner=owner,
        repo_name=repo_name,
        default_branch='main',
        status='pending',
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _start_indexing(row.id, canonical_url)
    return IndexedRepoStatusResponse(repoId=row.id, status='pending')


@router.get("/{repo_id}/status", response_model=IndexedRepoStatusResponse)
def get_repo_status(
    repo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(IndexedRepo, repo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Repo not found")
    return IndexedRepoStatusResponse(
        repoId=row.id,
        status=row.status,
        fileCount=row.file_count,
        chunkCount=row.chunk_count,
        errorMessage=row.error_message,
    )


@router.get("", response_model=list[IndexedRepoSummary])
def list_repos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(IndexedRepo).order_by(IndexedRepo.created_at.desc()).all()
    return [
        IndexedRepoSummary(
            id=r.id,
            owner=r.owner,
            repoName=r.repo_name,
            repoUrl=r.repo_url,
            status=r.status,
            indexedAt=r.indexed_at,
        )
        for r in rows
    ]
