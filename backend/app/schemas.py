from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    email: str


class CreateSessionRequest(BaseModel):
    learningGoal: str

class SessionResponse(BaseModel):
    id: int
    title: Optional[str]
    learningGoal: str
    status: str
    createdAt: datetime
    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    imageData: Optional[str] = None
    imageMediaType: Optional[str] = None
    createdAt: datetime
    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    message: str
    imageData: Optional[str] = None
    imageMediaType: Optional[str] = None

class ChatResponse(BaseModel):
    role: str
    content: str
    diagramCode: Optional[str] = None


class MemoryResponse(BaseModel):
    id: int
    key: str
    value: str
    category: str
    confidence: int
    model_config = {"from_attributes": True}

class KnowledgeNodeResponse(BaseModel):
    id: int
    conceptSlug: str
    conceptLabel: str
    mastery: int
    exposures: int
    model_config = {"from_attributes": True}


class QuizQuestionResponse(BaseModel):
    id: int
    question: str
    type: str
    choices: Optional[list] = None
    correctAnswer: str
    explanation: Optional[str] = None
    sortOrder: int
    model_config = {"from_attributes": True}

class QuizResponse(BaseModel):
    id: int
    sessionId: int
    questions: list[QuizQuestionResponse]
    model_config = {"from_attributes": True}


class ReviewDueResponse(BaseModel):
    conceptSlug: str
    conceptLabel: str
    intervalDays: int
    easeFactor: float
    repetitions: int
    model_config = {"from_attributes": True}

class RecordReviewRequest(BaseModel):
    quality: int  # 0-5


class ProgressResponse(BaseModel):
    totalConcepts: int
    mastered: int
    learning: int
    struggling: int
    avgMastery: float
    dueForReview: int


class CodeExecuteRequest(BaseModel):
    code: str
    language: str
    stdin: Optional[str] = None

class CodeExecuteResponse(BaseModel):
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exitCode: int


class UserResponse(BaseModel):
    id: int
    email: str
    createdAt: datetime
    model_config = {"from_attributes": True}
