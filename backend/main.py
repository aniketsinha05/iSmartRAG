import os
import shutil
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import chats, classrooms, quiz_store
from backend.auth import router as auth_router
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.excel.parse_excel import parse_excel_pieces
from backend.llm.generate_answer import call_groq_json, generate_answer
from backend.models import KnowledgeBase, User
from backend.pdf.parse_pdf import parse_pdf_pieces
from backend.ppt.parse_ppt import parse_ppt_pieces
from backend.quiz import (
    QuizAttemptRequest,
    QuizRequest,
    generate_questions,
    sample_chunks,
)
from backend.vector_store import (
    add_pieces,
    delete_source,
    get_source_chunks,
    list_sources,
    search,
)
from backend.website.scrape import normalize_url, scrape_website_pieces
from backend.word.parse_word import parse_word_pieces

app = FastAPI(title="MyBookAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:4173"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)  # /auth/register, /auth/login are the only public routes

# Every route below takes these two. If the token is missing or wrong,
# get_current_user raises 401 before the function body runs.
DB = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent))
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

PARSERS = {
    ".pdf": (parse_pdf_pieces, "pdf"),
    ".docx": (parse_word_pieces, "word"),
    ".pptx": (parse_ppt_pieces, "ppt"),
    ".xlsx": (parse_excel_pieces, "excel"),
    ".xlsm": (parse_excel_pieces, "excel"),
    ".xltx": (parse_excel_pieces, "excel"),
    ".xls": (parse_excel_pieces, "excel"),
    ".csv": (parse_excel_pieces, "excel"),
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _user_dir(user_id: int) -> Path:
    folder = UPLOAD_DIR / f"user_{user_id}"
    folder.mkdir(exist_ok=True)
    return folder


def _ingest_file(db: Session, user: User, file: UploadFile) -> dict:
    """Save an upload into the user's own folder and index it."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = Path(file.filename).name
    suffix = Path(filename).suffix.lower()
    if suffix not in PARSERS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    folder = _user_dir(user.id)
    tmp_path = folder / f"{uuid4().hex}{suffix}"  # keeps the extension for the parsers
    final_path = folder / filename
    try:
        with tmp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parser, doc_type = PARSERS[suffix]
        pieces = parser(str(tmp_path))
        if not pieces:
            raise HTTPException(status_code=400, detail="No readable text found.")

        doc_id, chunks = add_pieces(
            db, user.id, pieces, filename, doc_type,
            size_bytes=tmp_path.stat().st_size,
        )
        if doc_id is None:
            raise HTTPException(status_code=400, detail="No readable text found.")

        tmp_path.replace(final_path)  # only replace the old file once indexing worked
        return {
            "success": True,
            "document_id": doc_id,
            "filename": filename,
            "type": doc_type,
            "chunks": chunks,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")
    finally:
        tmp_path.unlink(missing_ok=True)
        file.file.close()


def _run_ask(db, user, question, n_results, document_ids=None, scope="your documents"):
    """document_ids None = search all of this user's documents; a list limits it."""
    results = search(
        db, user.id, question,
        n_results=max(1, min(n_results, 10)),
        document_ids=document_ids,
    )
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    if not documents:
        return f"I could not find this in {scope}.", []

    try:
        answer = generate_answer(question, documents, scope=scope)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"The AI service failed: {exc}")
    sources = sorted({m["source"] for m in metadatas if m.get("source")})
    return answer, sources


def _save_exchange(db, user, classroom_id, chat_id, question, answer):
    if chat_id:
        chats.add_messages(
            db, user.id, classroom_id, chat_id,
            [{"role": "user", "text": question}, {"role": "ai", "text": answer}],
        )


def _require_general_chat(db, user, chat_id):
    if chat_id and chats.get_chat(db, user.id, None, chat_id) is None:
        raise HTTPException(status_code=404, detail="Chat not found.")


def _classroom(db, user, classroom_id: int):
    room = classrooms.get_classroom(db, user.id, classroom_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Classroom not found.")
    return room


# ── Core ──────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "MyBookAI API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/upload")
def upload_file(db: DB, user: CurrentUser, file: UploadFile = File(...)):
    return _ingest_file(db, user, file)


@app.post("/website")
def add_website(url: str, db: DB, user: CurrentUser):
    url = normalize_url(url)
    try:
        pieces = scrape_website_pieces(url)
        if not pieces:
            raise HTTPException(status_code=400, detail="No readable text found.")
        doc_id, chunks = add_pieces(db, user.id, pieces, url, "website")
        return {
            "success": True, "document_id": doc_id,
            "url": url, "type": "website", "chunks": chunks,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to scrape website: {exc}")


@app.get("/search")
def search_documents(query: str, db: DB, user: CurrentUser, n_results: int = 3):
    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")
    try:
        r = search(db, user.id, query, n_results=max(1, min(n_results, 10)))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")

    docs = r.get("documents", [[]])[0]
    metas = r.get("metadatas", [[]])[0]
    dists = r.get("distances", [[]])[0]
    return {
        "query": query,
        "results": [
            {"text": d, "source": m.get("source"), "type": m.get("type"), "distance": x}
            for d, m, x in zip(docs, metas, dists)
        ],
    }


@app.get("/ask")
def ask(
    question: str, db: DB, user: CurrentUser,
    n_results: int = 3, chat_id: str | None = None,
):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    _require_general_chat(db, user, chat_id)

    answer, sources = _run_ask(db, user, question, n_results)
    _save_exchange(db, user, None, chat_id, question, answer)
    return {"question": question, "answer": answer, "sources": sources, "chat_id": chat_id}


# ── Chat page: ask with an optional classroom / document filter ──────────────

class ChatAskRequest(BaseModel):
    question: str
    classroom_ids: list[int] = []
    document_ids: list[int] = []
    chat_id: str | None = None
    n_results: int = 5


@app.post("/chat/ask")
def chat_ask(body: ChatAskRequest, db: DB, user: CurrentUser):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    _require_general_chat(db, user, body.chat_id)

    scope_ids = None  # None = all of the user's documents
    scope = "your documents"
    if body.classroom_ids or body.document_ids:
        owned = {s["id"] for s in list_sources(db, user.id)}
        if not set(body.document_ids) <= owned:
            raise HTTPException(status_code=400, detail="Unknown Knowledge Base document.")

        selected = set(body.document_ids)
        names = []
        for cid in body.classroom_ids:
            room = classrooms.get_classroom(db, user.id, cid)
            if room is None:
                raise HTTPException(status_code=400, detail="Invalid classroom ID.")
            names.append(room["name"])
            selected.update(classrooms.get_document_ids(db, user.id, cid))

        scope_ids = sorted(selected)  # an empty list correctly returns nothing
        scope = "the selected documents" if not names else "the " + " + ".join(names) + " Knowledge Base"

    answer, sources = _run_ask(db, user, question, body.n_results, scope_ids, scope)
    _save_exchange(db, user, None, body.chat_id, question, answer)
    return {"question": question, "answer": answer, "sources": sources, "chat_id": body.chat_id}


# ── General chats (classroom_id = NULL) ──────────────────────────────────────

@app.get("/chats")
def list_general_chats(db: DB, user: CurrentUser):
    return {"chats": chats.list_chats(db, user.id, None)}


@app.post("/chats")
def new_general_chat(db: DB, user: CurrentUser):
    chat = chats.create_chat(db, user.id, None)
    return {"id": chat["id"], "title": chat["title"]}


@app.get("/chats/{chat_id}")
def get_general_chat(chat_id: str, db: DB, user: CurrentUser):
    chat = chats.get_chat(db, user.id, None, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@app.delete("/chats/{chat_id}")
def delete_general_chat(chat_id: str, db: DB, user: CurrentUser):
    if not chats.delete_chat(db, user.id, None, chat_id):
        raise HTTPException(status_code=404, detail="Chat not found.")
    return {"success": True}


# ── Sources (Knowledge Base) - identified by id ──────────────────────────────

@app.get("/sources")
def get_sources(db: DB, user: CurrentUser):
    return {"sources": list_sources(db, user.id)}


@app.get("/sources/{document_id}/content")
def source_content(document_id: int, db: DB, user: CurrentUser, limit: int = 20):
    chunks = get_source_chunks(db, user.id, document_id, max(1, min(limit, 100)))
    if not chunks:
        raise HTTPException(status_code=404, detail="Source not found.")
    return {"id": document_id, "chunks": chunks}


@app.delete("/sources/{document_id}")
def remove_source(document_id: int, db: DB, user: CurrentUser):
    doc = db.get(KnowledgeBase, document_id)
    if doc is None or doc.user_id != user.id:
        raise HTTPException(status_code=404, detail="Source not found.")
    name, doc_type = doc.name, doc.type

    removed = delete_source(db, user.id, document_id)  # chunks + classroom links cascade
    if removed is None:
        raise HTTPException(status_code=404, detail="Source not found.")

    if doc_type != "website":
        try:
            (_user_dir(user.id) / Path(name).name).unlink(missing_ok=True)
        except OSError:
            pass
    return {"success": True, "removed_chunks": removed}


# ── Classrooms ───────────────────────────────────────────────────────────────

class ClassroomRequest(BaseModel):
    name: str


class DocumentsRequest(BaseModel):
    document_ids: list[int]


@app.get("/classrooms")
def get_classrooms(db: DB, user: CurrentUser):
    return {"classrooms": classrooms.list_classrooms(db, user.id)}


@app.post("/classrooms")
def create_classroom(body: ClassroomRequest, db: DB, user: CurrentUser):
    classroom_id, error = classrooms.create_classroom(db, user.id, body.name)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return classrooms.get_classroom(db, user.id, classroom_id)


@app.patch("/classrooms/{classroom_id}")
def rename_classroom(classroom_id: int, body: ClassroomRequest, db: DB, user: CurrentUser):
    ok, error = classrooms.rename_classroom(db, user.id, classroom_id, body.name)
    if not ok:
        status = 404 if error == "Classroom not found." else 400
        raise HTTPException(status_code=status, detail=error)
    return classrooms.get_classroom(db, user.id, classroom_id)


@app.delete("/classrooms/{classroom_id}")
def delete_classroom(classroom_id: int, db: DB, user: CurrentUser):
    _classroom(db, user, classroom_id)
    chats.delete_classroom_chats(db, user.id, classroom_id)  # first, see classrooms.py
    classrooms.delete_classroom(db, user.id, classroom_id)
    return {"success": True}


@app.get("/classrooms/{classroom_id}/documents")
def classroom_documents(classroom_id: int, db: DB, user: CurrentUser):
    room = _classroom(db, user, classroom_id)
    allowed = set(classrooms.get_document_ids(db, user.id, classroom_id))
    items = [s for s in list_sources(db, user.id) if s["id"] in allowed]
    return {"classroom": room, "documents": items}


@app.post("/classrooms/{classroom_id}/documents")
def import_documents(classroom_id: int, body: DocumentsRequest, db: DB, user: CurrentUser):
    _classroom(db, user, classroom_id)
    ids = list(dict.fromkeys(body.document_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one document.")

    owned = {s["id"] for s in list_sources(db, user.id)}
    if not set(ids) <= owned:
        raise HTTPException(status_code=400, detail="Not in your Knowledge Base.")

    added, skipped = classrooms.add_documents(db, user.id, classroom_id, ids)
    return {"success": True, "added": added, "skipped": skipped}


@app.delete("/classrooms/{classroom_id}/documents/{document_id}")
def remove_classroom_document(classroom_id: int, document_id: int, db: DB, user: CurrentUser):
    _classroom(db, user, classroom_id)
    if not classrooms.remove_document(db, user.id, classroom_id, document_id):
        raise HTTPException(status_code=404, detail="Document is not in this classroom.")
    return {"success": True, "removed": document_id}


@app.post("/classrooms/{classroom_id}/upload")
def classroom_upload(
    classroom_id: int, db: DB, user: CurrentUser, file: UploadFile = File(...)
):
    _classroom(db, user, classroom_id)
    result = _ingest_file(db, user, file)
    added, skipped = classrooms.add_documents(
        db, user.id, classroom_id, [result["document_id"]]
    )
    return {**result, "classroom_id": classroom_id, "added": added, "skipped": skipped}


# ── Quiz ─────────────────────────────────────────────────────────────────────

@app.post("/classrooms/{classroom_id}/quiz")
def create_quiz(classroom_id: int, body: QuizRequest, db: DB, user: CurrentUser):
    _classroom(db, user, classroom_id)

    ids = classrooms.get_document_ids(db, user.id, classroom_id)
    if body.document_ids:
        ids = [i for i in ids if i in body.document_ids]
    if not ids:
        raise HTTPException(status_code=400, detail="Upload documents first.")

    names = {s["id"]: s["name"] for s in list_sources(db, user.id)}
    chunks_by_doc = {
        names[i]: [{"text": t} for t in get_source_chunks(db, user.id, i, limit=200)]
        for i in ids if i in names
    }
    chunks = sample_chunks(chunks_by_doc, body.num_questions + 2)
    if not chunks:
        raise HTTPException(status_code=400, detail="These documents have no readable text.")

    try:
        questions = generate_questions(call_groq_json, chunks, body)
    except Exception as exc:
        print("Quiz generation failed:", exc)
        raise HTTPException(
            status_code=502,
            detail="The AI service failed or is rate-limited. Try again in a minute.",
        )
    if not questions:
        raise HTTPException(status_code=502, detail="Could not generate the quiz. Please try again.")
    return {"questions": questions}


@app.post("/quiz/attempts")
def save_quiz_attempt(body: QuizAttemptRequest, db: DB, user: CurrentUser):
    room = _classroom(db, user, body.classroom_id)
    if not body.questions or len(body.answers) != len(body.questions):
        raise HTTPException(status_code=400, detail="Answers must match the questions.")
    settings = {
        "difficulty": body.difficulty,
        "include_true_false": body.include_true_false,
    }
    return quiz_store.save_attempt(
        db, user.id, body.classroom_id, room["name"], settings, body.questions, body.answers
    )


@app.get("/quiz/attempts")
def list_quiz_attempts(db: DB, user: CurrentUser, limit: int = 50):
    return {"attempts": quiz_store.list_attempts(db, user.id, min(max(limit, 1), 200))}


@app.get("/quiz/attempts/{attempt_id}")
def get_quiz_attempt(attempt_id: str, db: DB, user: CurrentUser):
    attempt = quiz_store.get_attempt(db, user.id, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    return attempt