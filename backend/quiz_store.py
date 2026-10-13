"""
quiz_store.py
Quiz attempts, saved in backend/quiz_attempts.json (a list, newest last).
Each attempt keeps the full quiz and the answers, so Review still works
after the classroom is renamed or deleted.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE, "quiz_attempts.json")

_lock = threading.Lock()


def _load():
    if os.path.exists(PATH):
        with open(PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def _save(data):
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _summary(a):
    keys = ("id", "classroom_id", "classroom_name", "created_at",
            "num_questions", "correct", "score")
    return {k: a[k] for k in keys}


def save_attempt(classroom_id, classroom_name, settings, questions, answers):
    total = len(questions)
    correct = sum(
        1 for q, a in zip(questions, answers)
        if a is not None and a == q.get("answer_index")
    )
    attempt = {
        "id": str(uuid.uuid4()),
        "classroom_id": classroom_id,
        "classroom_name": classroom_name,  # snapshot, survives rename/delete
        "created_at": _now(),
        "num_questions": total,
        "correct": correct,
        "score": round(100 * correct / total) if total else 0,
        "settings": settings,
        "questions": questions,
        "answers": answers,
    }
    with _lock:
        data = _load()
        data.append(attempt)
        _save(data)
    return _summary(attempt)


def list_attempts(limit=50):
    with _lock:
        data = _load()
    return [_summary(a) for a in reversed(data)][:limit]


def get_attempt(attempt_id):
    with _lock:
        for a in _load():
            if a["id"] == attempt_id:
                return a
    return None