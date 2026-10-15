from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models import Classroom, ClassroomDocument, KnowledgeBase

MAX_CLASSROOMS = 20  # per user


def _valid_name(name):
    return isinstance(name, str) and 1 <= len(name.strip()) <= 40


def _get(db: Session, user_id: int, classroom_id):
    """Return the classroom only if it belongs to this user."""
    if not isinstance(classroom_id, int):
        return None
    return db.scalar(
        select(Classroom).where(
            Classroom.id == classroom_id, Classroom.user_id == user_id
        )
    )


def _name_taken(db: Session, user_id: int, name: str, exclude_id=None) -> bool:
    q = select(Classroom.id).where(
        Classroom.user_id == user_id,
        func.lower(Classroom.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        q = q.where(Classroom.id != exclude_id)
    return db.scalar(q) is not None


def _doc_count(db: Session, classroom_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ClassroomDocument)
        .where(ClassroomDocument.classroom_id == classroom_id)
    )


def is_valid(db, user_id, classroom_id):
    return _get(db, user_id, classroom_id) is not None


def get_classroom(db, user_id, classroom_id):
    room = _get(db, user_id, classroom_id)
    if not room:
        return None
    return {
        "id": room.id,
        "name": room.name,
        "document_count": _doc_count(db, room.id),
    }


def list_classrooms(db, user_id):
    rows = db.execute(
        select(Classroom.id, Classroom.name, func.count(ClassroomDocument.document_id))
        .outerjoin(ClassroomDocument, ClassroomDocument.classroom_id == Classroom.id)
        .where(Classroom.user_id == user_id)
        .group_by(Classroom.id, Classroom.name)
        .order_by(Classroom.id)
    ).all()
    return [{"id": r[0], "name": r[1], "document_count": r[2]} for r in rows]


def create_classroom(db, user_id, name):
    if not _valid_name(name):
        return None, "Name must be 1-40 characters."
    name = name.strip()

    count = db.scalar(
        select(func.count()).select_from(Classroom).where(Classroom.user_id == user_id)
    )
    if count >= MAX_CLASSROOMS:
        return None, f"Maximum of {MAX_CLASSROOMS} classrooms reached."
    if _name_taken(db, user_id, name):
        return None, "A classroom with this name already exists."

    room = Classroom(user_id=user_id, name=name)
    db.add(room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None, "A classroom with this name already exists."
    db.refresh(room)
    return room.id, None


def rename_classroom(db, user_id, classroom_id, name):
    if not _valid_name(name):
        return False, "Name must be 1-40 characters."
    name = name.strip()

    room = _get(db, user_id, classroom_id)
    if not room:
        return False, "Classroom not found."
    if _name_taken(db, user_id, name, exclude_id=room.id):
        return False, "A classroom with this name already exists."

    room.name = name
    room.updated_at = func.now()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False, "A classroom with this name already exists."
    return True, None


def delete_classroom(db, user_id, classroom_id):
    room = _get(db, user_id, classroom_id)
    if not room:
        return False
    # classroom_documents rows cascade; chats/quiz_attempts.classroom_id -> NULL
    db.delete(room)
    db.commit()
    return True


def get_sources(db, user_id, classroom_id):
    room = _get(db, user_id, classroom_id)
    if not room:
        return []
    rows = db.scalars(
        select(KnowledgeBase.name)
        .join(ClassroomDocument, ClassroomDocument.document_id == KnowledgeBase.id)
        .where(
            ClassroomDocument.classroom_id == room.id,
            KnowledgeBase.user_id == user_id,
        )
        .order_by(ClassroomDocument.added_at, KnowledgeBase.id)
    ).all()
    return list(rows)


def _get_or_create_doc(db: Session, user_id: int, name: str) -> KnowledgeBase:
    doc = db.scalar(
        select(KnowledgeBase).where(
            KnowledgeBase.user_id == user_id, KnowledgeBase.name == name
        )
    )
    if doc is None:
        # Placeholder until document records move to the DB (later step).
        doc = KnowledgeBase(
            user_id=user_id,
            name=name,
            type=Path(name).suffix.lower().lstrip(".") or "unknown",
        )
        db.add(doc)
        db.flush()
    return doc


def add_sources(db, user_id, classroom_id, names):
    added, skipped = [], []
    room = _get(db, user_id, classroom_id)
    if not room:
        return added, list(names)

    for name in names:
        doc = _get_or_create_doc(db, user_id, name)
        exists = db.scalar(
            select(ClassroomDocument).where(
                ClassroomDocument.classroom_id == room.id,
                ClassroomDocument.document_id == doc.id,
            )
        )
        if exists:
            skipped.append(name)
        else:
            db.add(ClassroomDocument(classroom_id=room.id, document_id=doc.id))
            added.append(name)

    db.commit()
    return added, skipped


def remove_source(db, user_id, classroom_id, name):
    room = _get(db, user_id, classroom_id)
    if not room:
        return False
    doc = db.scalar(
        select(KnowledgeBase).where(
            KnowledgeBase.user_id == user_id, KnowledgeBase.name == name
        )
    )
    if not doc:
        return False
    result = db.execute(
        delete(ClassroomDocument).where(
            ClassroomDocument.classroom_id == room.id,
            ClassroomDocument.document_id == doc.id,
        )
    )
    db.commit()
    return result.rowcount > 0


def remove_source_everywhere(db, user_id, name):
    doc = db.scalar(
        select(KnowledgeBase).where(
            KnowledgeBase.user_id == user_id, KnowledgeBase.name == name
        )
    )
    if not doc:
        return 0
    result = db.execute(
        delete(ClassroomDocument).where(ClassroomDocument.document_id == doc.id)
    )
    db.commit()
    return result.rowcount