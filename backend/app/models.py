from datetime import datetime, timezone
from sqlalchemy import BigInteger, Boolean, Column, Double, ForeignKey, Integer, SmallInteger, String, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from .database import Base


def now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    sessions = relationship("LearningSession", back_populates="user", cascade="all, delete-orphan")


class LearningSession(Base):
    __tablename__ = "learning_sessions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255))
    learning_goal = Column(Text, nullable=False)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    curriculum = relationship("Curriculum", back_populates="session", uselist=False, cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(10), nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    image_data = Column(Text)
    image_media_type = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    session = relationship("LearningSession", back_populates="messages")


class Curriculum(Base):
    __tablename__ = "curricula"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    session = relationship("LearningSession", back_populates="curriculum")


class UserMemory(Base):
    __tablename__ = "user_memories"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(160), nullable=False)
    value = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    confidence = Column(SmallInteger, default=50)
    source_session_id = Column(BigInteger)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    concept_slug = Column(String(160), nullable=False)
    concept_label = Column(String(255), nullable=False)
    mastery = Column(SmallInteger, default=0, nullable=False)
    exposures = Column(Integer, default=0, nullable=False)
    last_session_id = Column(BigInteger)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan", order_by="QuizQuestion.sort_order")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    quiz_id = Column(BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    type = Column(String(20), default="MCQ")
    choices = Column(JSON)
    correct_answer = Column(Text)
    explanation = Column(Text)
    sort_order = Column(SmallInteger, default=0)
    quiz = relationship("Quiz", back_populates="questions")


class ConceptReview(Base):
    __tablename__ = "concept_reviews"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    concept_slug = Column(String(160), nullable=False)
    concept_label = Column(String(255), nullable=False)
    ease_factor = Column(Double, default=2.5, nullable=False)
    interval_days = Column(Integer, default=1, nullable=False)
    repetitions = Column(Integer, default=0, nullable=False)
    next_review_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    last_reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
