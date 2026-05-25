from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, UserMemory, KnowledgeNode
from ..auth import get_current_user
from ..schemas import MemoryResponse, KnowledgeNodeResponse

router = APIRouter(prefix="/api", tags=["memory"])


@router.get("/memory", response_model=list[MemoryResponse])
def get_memories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memories = db.query(UserMemory).filter(UserMemory.user_id == current_user.id).order_by(
        UserMemory.confidence.desc(), UserMemory.updated_at.desc()).all()
    return [MemoryResponse(id=m.id, key=m.key, value=m.value,
                           category=m.category, confidence=m.confidence) for m in memories]


@router.get("/knowledge-graph", response_model=list[KnowledgeNodeResponse])
def get_graph(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == current_user.id).order_by(
        KnowledgeNode.mastery.desc()).all()
    return [KnowledgeNodeResponse(id=n.id, conceptSlug=n.concept_slug, conceptLabel=n.concept_label,
                                   mastery=n.mastery, exposures=n.exposures) for n in nodes]
