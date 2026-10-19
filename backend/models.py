from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_knowledge_base_user_name"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    chunks: Mapped[Optional[int]] = mapped_column(Integer, server_default=text("0"))
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    added_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class VectorChunk(Base):
    __tablename__ = "vector_chunks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[Optional[int]] = mapped_column(Integer)
    sheet: Mapped[Optional[str]] = mapped_column(String)
    rows: Mapped[Optional[str]] = mapped_column(String)
    section: Mapped[Optional[str]] = mapped_column(String)
    model: Mapped[str] = mapped_column(String, nullable=False)
    added_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class Classroom(Base):
    __tablename__ = "classrooms"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_classrooms_user_name"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class ClassroomDocument(Base):
    __tablename__ = "classroom_documents"
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.id", ondelete="CASCADE"), primary_key=True)
    added_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class Chat(Base):
    __tablename__ = "chats"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"))
    title: Mapped[Optional[str]] = mapped_column(String, server_default=text("'New chat'"))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"))
    classroom_name: Mapped[str] = mapped_column(String, nullable=False)
    num_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    include_true_false: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)
    answer_index: Mapped[int] = mapped_column(Integer, nullable=False)
    user_answer: Mapped[Optional[int]] = mapped_column(Integer)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    source_file: Mapped[Optional[str]] = mapped_column(String)
    source_page: Mapped[Optional[int]] = mapped_column(Integer)
    source_section: Mapped[Optional[str]] = mapped_column(String)