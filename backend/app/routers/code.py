import httpx
from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_current_user
from ..models import User
from ..schemas import CodeExecuteRequest, CodeExecuteResponse
from ..config import settings

router = APIRouter(prefix="/api/code", tags=["code"])

JUDGE0_URL = "https://judge0-ce.p.rapidapi.com"
LANGUAGE_IDS = {
    "python": 71, "javascript": 63, "java": 62, "cpp": 54,
    "c": 50, "typescript": 74, "go": 60, "rust": 73,
}


@router.post("/execute", response_model=CodeExecuteResponse)
def execute_code(req: CodeExecuteRequest, current_user: User = Depends(get_current_user)):
    if not settings.judge0_rapidapi_key:
        raise HTTPException(status_code=503, detail="Code execution not configured")

    lang_id = LANGUAGE_IDS.get(req.language.lower())
    if not lang_id:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")

    headers = {
        "x-rapidapi-key": settings.judge0_rapidapi_key,
        "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
        "content-type": "application/json",
    }
    payload = {"source_code": req.code, "language_id": lang_id, "stdin": req.stdin or ""}

    with httpx.Client(timeout=30) as client:
        r = client.post(f"{JUDGE0_URL}/submissions?wait=true", json=payload, headers=headers)
        if r.status_code != 200 and r.status_code != 201:
            raise HTTPException(status_code=502, detail="Code execution service error")
        data = r.json()

    return CodeExecuteResponse(
        stdout=data.get("stdout"),
        stderr=data.get("stderr") or data.get("compile_output"),
        exitCode=data.get("exit_code") or 0,
    )
