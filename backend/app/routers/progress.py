from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, KnowledgeNode, ConceptReview
from ..auth import get_current_user
from ..schemas import ProgressResponse

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=ProgressResponse)
def get_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nodes = db.query(KnowledgeNode).filter(
        KnowledgeNode.user_id == current_user.id
    ).order_by(KnowledgeNode.exposures.desc(), KnowledgeNode.mastery.desc()).limit(15).all()

    total = len(nodes)
    mastered = sum(1 for n in nodes if n.mastery >= 75)
    learning = sum(1 for n in nodes if 30 <= n.mastery < 75)
    struggling = total - mastered - learning
    avg = round(sum(n.mastery for n in nodes) / total, 1) if total else 0.0

    now = datetime.now(timezone.utc)
    due = db.query(ConceptReview).filter(
        ConceptReview.user_id == current_user.id,
        ConceptReview.next_review_at <= now
    ).count()

    return ProgressResponse(totalConcepts=total, mastered=mastered, learning=learning,
                             struggling=struggling, avgMastery=avg, dueForReview=due)
