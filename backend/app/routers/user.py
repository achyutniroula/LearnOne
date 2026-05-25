from fastapi import APIRouter, Depends
from ..models import User
from ..auth import get_current_user
from ..schemas import UserResponse

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, createdAt=current_user.created_at)
