"""
chats.py
Chat history of the classrooms, saved in backend/chats.json (a list of chats per classroom).
A chat belongs to ONE classroom: a chat id from another classroom is never found.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE, "chats.json")

_lock = threading.Lock()


def _load():
    if os.path.exists(PATH):
        with open(PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save(data):
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _find(data, classroom_id, chat_id):
    return next((c for c in data.get(str(classroom_id), []) if c["id"] == chat_id), None)


def list_chats(classroom_id):
    """Newest first. Messages are not included (use get_chat)."""
    with _lock:
        chats = _load().get(str(classroom_id), [])

    items = [
        {
            "id": c["id"],
            "title": c["title"],
            "updated_at": c["updated_at"],
            "message_count": len(c["messages"]),
        }
        for c in chats
    ]
    return sorted(items, key=lambda c: c["updated_at"], reverse=True)


def get_chat(classroom_id, chat_id):
    with _lock:
        return _find(_load(), classroom_id, chat_id)


def create_chat(classroom_id):
    with _lock:
        data = _load()
        chat = {
            "id": uuid.uuid4().hex[:12],
            "title": "New chat",
            "created_at": _now(),
            "updated_at": _now(),
            "messages": [],
        }
        data.setdefault(str(classroom_id), []).append(chat)
        _save(data)
    return chat


def add_messages(classroom_id, chat_id, messages):
    """messages: [{"role": "user" | "ai", "text": str}]. False if the chat is not in this classroom."""
    with _lock:
        data = _load()
        chat = _find(data, classroom_id, chat_id)

        if chat is None:
            return False

        if not chat["messages"] and messages:
            first = messages[0]["text"].strip()
            chat["title"] = first if len(first) <= 60 else first[:57] + "..."

        chat["messages"] += messages
        chat["updated_at"] = _now()
        _save(data)
    return True


def delete_chat(classroom_id, chat_id):
    with _lock:
        data = _load()
        chat = _find(data, classroom_id, chat_id)

        if chat is None:
            return False

        data[str(classroom_id)].remove(chat)
        _save(data)
    return True