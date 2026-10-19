"""
chats.py
Chat history, stored in PostgreSQL (tables chats and chat_messages).
A chat belongs to ONE user and ONE classroom (or to no classroom = general chat).
classroom_id 0 or None both mean "general chat", so the old GENERAL_CHAT_BUCKET = 0 still works.
"""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.models import Chat, ChatMessage, Classroom


def _cid(classroom_id):
    return None if classroom_id in (None, 0) else classroom_id


def _scope(classroom_id):
    cid = _cid(classroom_id)
    return Chat.classroom_id.is_(None) if cid is None else Chat.classroom_id == cid


def _iso(value):
    return value.isoformat() if value else None


def _find(db: Session, user_id, classroom_id, chat_id):
    return db.scalar(
        select(Chat).where(
            Chat.id == chat_id, Chat.user_id == user_id, _scope(classroom_id)
        )
    )


def list_chats(db: Session, user_id, classroom_id):
    """Newest first. Messages are not included (use get_chat)."""
    rows = db.execute(
        select(Chat, func.count(ChatMessage.id))
        .outerjoin(ChatMessage, ChatMessage.chat_id == Chat.id)
        .where(Chat.user_id == user_id, _scope(classroom_id))
        .group_by(Chat.id)
        .order_by(Chat.updated_at.desc())
    ).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "updated_at": _iso(c.updated_at),
            "message_count": n,
        }
        for c, n in rows
    ]


def get_chat(db: Session, user_id, classroom_id, chat_id):
    chat = _find(db, user_id, classroom_id, chat_id)
    if chat is None:
        return None
    msgs = db.scalars(
        select(ChatMessage).where(ChatMessage.chat_id == chat.id).order_by(ChatMessage.id)
    ).all()
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": _iso(chat.created_at),
        "updated_at": _iso(chat.updated_at),
        "messages": [{"role": m.role, "text": m.text} for m in msgs],
    }


def create_chat(db: Session, user_id, classroom_id):
    """Returns None if the classroom is not this user's."""
    cid = _cid(classroom_id)
    if cid is not None:
        owned = db.scalar(
            select(Classroom.id).where(Classroom.id == cid, Classroom.user_id == user_id)
        )
        if owned is None:
            return None

    chat = Chat(id=uuid.uuid4().hex[:12], user_id=user_id, classroom_id=cid, title="New chat")
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": _iso(chat.created_at),
        "updated_at": _iso(chat.updated_at),
        "messages": [],
    }


def add_messages(db: Session, user_id, classroom_id, chat_id, messages):
    """messages: [{"role": "user" | "ai", "text": str}]. False if the chat is not found."""
    chat = _find(db, user_id, classroom_id, chat_id)
    if chat is None:
        return False

    existing = db.scalar(
        select(func.count()).select_from(ChatMessage).where(ChatMessage.chat_id == chat.id)
    )
    if existing == 0 and messages:
        first = messages[0]["text"].strip()
        chat.title = first if len(first) <= 60 else first[:57] + "..."

    for m in messages:
        db.add(ChatMessage(chat_id=chat.id, role=m["role"], text=m["text"]))
    chat.updated_at = func.now()
    db.commit()
    return True


def delete_chat(db: Session, user_id, classroom_id, chat_id):
    chat = _find(db, user_id, classroom_id, chat_id)
    if chat is None:
        return False
    db.delete(chat)  # messages are removed by ON DELETE CASCADE
    db.commit()
    return True


def delete_classroom_chats(db: Session, user_id, classroom_id):
    result = db.execute(
        delete(Chat).where(Chat.user_id == user_id, Chat.classroom_id == classroom_id)
    )
    db.commit()
    return result.rowcount > 0