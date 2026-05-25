from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, ConceptReview
from ..auth import get_current_user
from ..schemas import ReviewDueResponse, RecordReviewRequest

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/due", response_model=list[ReviewDueResponse])
def get_due(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    reviews = db.query(ConceptReview).filter(
        ConceptReview.user_id == current_user.id,
        ConceptReview.next_review_at <= now
    ).order_by(ConceptReview.next_review_at.asc()).all()
    return [_to_response(r) for r in reviews]


@router.post("/{concept_slug}/record", status_code=204)
def record_review(concept_slug: str, req: RecordReviewRequest,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(ConceptReview).filter(
        ConceptReview.user_id == current_user.id,
        ConceptReview.concept_slug == concept_slug
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    quality = max(0, min(5, req.quality))
    now = datetime.now(timezone.utc)

    if quality < 3:
        r.repetitions = 0
        r.interval_days = 1
    else:
        n = r.repetitions
        if n == 0:
            r.interval_days = 1
        elif n == 1:
            r.interval_days = 6
        else:
            r.interval_days = round(r.interval_days * r.ease_factor)
        r.repetitions = n + 1

    ef = r.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    r.ease_factor = max(1.3, ef)
    r.next_review_at = now + timedelta(days=r.interval_days)
    r.last_reviewed_at = now
    db.commit()


def _to_response(r: ConceptReview) -> ReviewDueResponse:
    return ReviewDueResponse(conceptSlug=r.concept_slug, conceptLabel=r.concept_label,
                              intervalDays=r.interval_days, easeFactor=r.ease_factor,
                              repetitions=r.repetitions)
