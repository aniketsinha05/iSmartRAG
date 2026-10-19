"""
quiz_store.py
Quiz attempts, stored in PostgreSQL (quiz_attempts and quiz_questions).
Each attempt keeps the full quiz and the answers, so Review still works after the
classroom is renamed or deleted (classroom_name is a snapshot, classroom_id becomes NULL).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import QuizAttempt, QuizQuestion


def _iso(value):
    return value.isoformat() if value else None


def _summary(a: QuizAttempt):
    return {
        "id": a.id,
        "classroom_id": a.classroom_id,
        "classroom_name": a.classroom_name,
        "created_at": _iso(a.created_at),
        "num_questions": a.num_questions,
        "correct": a.correct,
        "score": a.score,
    }


def save_attempt(db: Session, user_id, classroom_id, classroom_name, settings, questions, answers):
    total = len(questions)
    correct = sum(
        1 for q, a in zip(questions, answers)
        if a is not None and a == q.get("answer_index")
    )
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_id=user_id,
        classroom_id=classroom_id,
        classroom_name=classroom_name,
        num_questions=total,
        correct=correct,
        score=round(100 * correct / total) if total else 0,
        difficulty=settings.get("difficulty", "medium"),
        include_true_false=bool(settings.get("include_true_false")),
    )
    db.add(attempt)
    db.flush()  # the attempt row must exist before its questions

    for i, (q, a) in enumerate(zip(questions, answers)):
        src = q.get("source") or {}
        db.add(QuizQuestion(
            # the 3-digit prefix keeps the question order
            id=f"{i:03d}_{q.get('id') or uuid.uuid4()}",
            attempt_id=attempt.id,
            type=q.get("type", "mcq"),
            question=q["question"],
            options=q.get("options", []),
            answer_index=q["answer_index"],
            user_answer=a,
            explanation=q.get("explanation"),
            source_file=src.get("file"),
            source_page=src.get("page"),
            source_section=src.get("section"),
        ))
    db.commit()
    db.refresh(attempt)
    return _summary(attempt)


def list_attempts(db: Session, user_id, limit=50):
    rows = db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(limit)
    ).all()
    return [_summary(a) for a in rows]


def get_attempt(db: Session, user_id, attempt_id):
    a = db.scalar(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id
        )
    )
    if a is None:
        return None

    qs = db.scalars(
        select(QuizQuestion)
        .where(QuizQuestion.attempt_id == a.id)
        .order_by(QuizQuestion.id)
    ).all()

    return {
        **_summary(a),
        "settings": {
            "document_names": [],
            "difficulty": a.difficulty,
            "include_true_false": a.include_true_false,
        },
        "questions": [
            {
                "id": q.id,
                "type": q.type,
                "question": q.question,
                "options": q.options,
                "answer_index": q.answer_index,
                "explanation": q.explanation or "",
                "source": {
                    "file": q.source_file,
                    "page": q.source_page,
                    "section": q.source_section,
                },
            }
            for q in qs
        ],
        "answers": [q.user_answer for q in qs],
    }