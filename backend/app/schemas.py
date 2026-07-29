from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel


class IndexRepoRequest(BaseModel):
    repo_url: str

class IndexedRepoStatusResponse(BaseModel):
    repoId: int
    status: str
    fileCount: Optional[int] = None
    totalChunks: Optional[int] = None
    chunkCount: Optional[int] = None
    errorMessage: Optional[str] = None

class IndexedRepoSummary(BaseModel):
    id: int
    owner: str
    repoName: str
    repoUrl: str
    status: str
    indexedAt: Optional[datetime] = None
    model_config = {"from_attributes": True}


class ExplainRequest(BaseModel):
    mode: Literal["noobie", "normal"]

class ExplainKickoffResponse(BaseModel):
    status: str
    repoId: int
    mode: str
    queued: list[str]

class ExplainSectionStatus(BaseModel):
    status: str
    error: Optional[str] = None

class ExplainStatusResponse(BaseModel):
    repoId: int
    mode: str
    overall: str
    sections: dict[str, ExplainSectionStatus]

class ExplainSectionResponse(BaseModel):
    repoId: int
    mode: str
    section: str
    status: str
    content: Optional[dict] = None
    generatedAt: Optional[datetime] = None
