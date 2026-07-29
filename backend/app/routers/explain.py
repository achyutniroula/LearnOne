import threading
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import IndexedRepo, RepoExplanation
from ..schemas import (
    ExplainRequest,
    ExplainKickoffResponse,
    ExplainStatusResponse,
    ExplainSectionStatus,
    ExplainSectionResponse,
)
from ..services.explainer_service import SECTIONS, generate_all_sections

router = APIRouter(prefix="/api/repos", tags=["explain"])


def _start_generation(repo_id: int, mode: str) -> None:
    threading.Thread(
        target=generate_all_sections,
        args=(repo_id, mode),
        daemon=True,
    ).start()


@router.post("/{repo_id}/explain", response_model=ExplainKickoffResponse, status_code=202)
def start_explain(
    repo_id: int,
    req: ExplainRequest,
    db: Session = Depends(get_db),
):
    repo = db.get(IndexedRepo, repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    if repo.status != "ready":
        raise HTTPException(status_code=400, detail="Repo is not indexed yet")

    mode = req.mode

    existing_rows = {
        row.section: row
        for row in db.query(RepoExplanation).filter(
            RepoExplanation.repo_id == repo_id,
            RepoExplanation.mode == mode,
        )
    }

    queued: list[str] = []
    for section in SECTIONS:
        row = existing_rows.get(section)
        if row is not None and row.status == "ready":
            continue
        if row is None:
            row = RepoExplanation(repo_id=repo_id, mode=mode, section=section, status="pending")
            db.add(row)
        elif row.status not in ("pending", "generating"):
            row.status = "pending"
            row.error = None
        queued.append(section)

    db.commit()

    all_ready = len(queued) == 0
    if queued:
        _start_generation(repo_id, mode)

    return ExplainKickoffResponse(
        status="ready" if all_ready else "pending",
        repoId=repo_id,
        mode=mode,
        queued=queued,
    )


@router.get("/{repo_id}/explain/status", response_model=ExplainStatusResponse)
def get_explain_status(
    repo_id: int,
    mode: Literal["noobie", "normal"] = Query("normal"),
    db: Session = Depends(get_db),
):
    rows = {
        row.section: row
        for row in db.query(RepoExplanation).filter(
            RepoExplanation.repo_id == repo_id,
            RepoExplanation.mode == mode,
        )
    }

    sections: dict[str, ExplainSectionStatus] = {}
    for section in SECTIONS:
        row = rows.get(section)
        if row is None:
            sections[section] = ExplainSectionStatus(status="not_started", error=None)
        else:
            sections[section] = ExplainSectionStatus(status=row.status, error=row.error)

    statuses = [s.status for s in sections.values()]
    if all(s == "ready" for s in statuses):
        overall = "ready"
    elif any(s == "failed" for s in statuses) and not any(s in ("pending", "generating") for s in statuses):
        overall = "failed"
    elif all(s == "not_started" for s in statuses):
        overall = "not_started"
    else:
        overall = "pending"

    return ExplainStatusResponse(repoId=repo_id, mode=mode, overall=overall, sections=sections)


@router.get("/{repo_id}/explain/{section}", response_model=ExplainSectionResponse)
def get_explain_section(
    repo_id: int,
    section: str,
    mode: Literal["noobie", "normal"] = Query("normal"),
    db: Session = Depends(get_db),
):
    if section not in SECTIONS:
        raise HTTPException(status_code=404, detail="Unknown section")

    row = (
        db.query(RepoExplanation)
        .filter(
            RepoExplanation.repo_id == repo_id,
            RepoExplanation.mode == mode,
            RepoExplanation.section == section,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Section not found")
    if row.status != "ready":
        raise HTTPException(status_code=409, detail={"detail": "Section not ready", "status": row.status})

    return ExplainSectionResponse(
        repoId=repo_id,
        mode=mode,
        section=section,
        status=row.status,
        content=row.content,
        generatedAt=row.generated_at,
    )
