from datetime import datetime, timezone
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String, Text, DateTime, JSON, UniqueConstraint, func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from .database import Base


def now_utc():
    return datetime.now(timezone.utc)


class IndexedRepo(Base):
    __tablename__ = "indexed_repos"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    repo_url = Column(Text, nullable=False, unique=True)
    owner = Column(String(255), nullable=False)
    repo_name = Column(String(255), nullable=False)
    default_branch = Column(String(255), nullable=False, default="main")
    status = Column(String(20), nullable=False, default="pending")
    file_count = Column(Integer)
    total_chunks = Column(Integer)
    chunk_count = Column(Integer)
    error_message = Column(Text)
    indexed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    chunks = relationship("RepoChunk", back_populates="repo", cascade="all, delete-orphan")
    explanations = relationship("RepoExplanation", back_populates="repo", cascade="all, delete-orphan")


class RepoChunk(Base):
    __tablename__ = "repo_chunks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    repo_id = Column(BigInteger, ForeignKey("indexed_repos.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_estimate = Column(Integer)
    embedding = Column(Vector(768))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    repo = relationship("IndexedRepo", back_populates="chunks")


class RepoExplanation(Base):
    __tablename__ = "repo_explanations"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    repo_id = Column(BigInteger, ForeignKey("indexed_repos.id", ondelete="CASCADE"), nullable=False)
    mode = Column(String(16), nullable=False)
    section = Column(String(16), nullable=False)
    content = Column(JSON)
    status = Column(String(16), nullable=False, default="pending")
    error = Column(Text)
    generated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    repo = relationship("IndexedRepo", back_populates="explanations")

    __table_args__ = (
        UniqueConstraint("repo_id", "mode", "section", name="repo_explanations_uniq"),
    )
