import shutil
from pathlib import Path

from backend.auth import router as auth_router

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from backend.quiz import QuizRequest, QuizAttemptRequest, sample_chunks, build_prompt, validate, generate_questions
from pydantic import BaseModel, Field
from backend import chats, classrooms, quiz_store
from backend.vector_store import (
    add_pieces,
    delete_source,
    get_source_chunks,
    list_sources,
    search,
)
from backend.llm.generate_answer import generate_answer, call_groq_json
from backend.excel.parse_excel import parse_excel_pieces
from backend.ppt.parse_ppt import parse_ppt_pieces
from backend.word.parse_word import parse_word_pieces
from backend.pdf.parse_pdf import parse_pdf_pieces
from backend.website.scrape import scrape_website_pieces, normalize_url



app = FastAPI(title="MyBookAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Sentinel classroom_id used for the general (non-classroom) chat bucket.
# chats.py stores by str(classroom_id), so "0" is a valid key that never
# conflicts with real classrooms (which are 1-5).
GENERAL_CHAT_BUCKET = 0

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


# ── Core ──────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "MyBookAI API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = Path(file.filename).name
    suffix = Path(filename).suffix.lower()
    if suffix not in PARSERS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    file_path = UPLOAD_DIR / filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parser, doc_type = PARSERS[suffix]
        pieces = parser(str(file_path))
        if not pieces:
            raise HTTPException(status_code=400, detail="No readable text found.")

        chunks = add_pieces(pieces, filename, doc_type)
        return {"success": True, "filename": filename, "type": doc_type, "chunks": chunks}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")
    finally:
        file.file.close()


@app.post("/website")
def add_website(url: str):
    url = normalize_url(url)
    try:
        pieces = scrape_website_pieces(url)
        if not pieces:
            raise HTTPException(status_code=400, detail="No readable text found.")
        chunks = add_pieces(pieces, url, "website")
        return {"success": True, "url": url, "type": "website", "chunks": chunks}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to scrape website: {exc}")


@app.get("/search")
def search_documents(query: str, n_results: int = 3):
    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        r = search(query, n_results=max(1, min(n_results, 10)))
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")


@app.get("/ask")
def ask(question: str, n_results: int = 3, chat_id: str | None = None):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    # If a chat_id is provided it must exist in the general bucket
    if chat_id is not None and chats.get_chat(GENERAL_CHAT_BUCKET, chat_id) is None:
        raise HTTPException(status_code=404, detail="Chat not found.")

    try:
        results = search(question, n_results=max(1, min(n_results, 10)))
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if not documents:
            answer = "No documents found. Please upload a file first."
            sources = []
        else:
            answer = generate_answer(question, documents)
            sources = sorted({m.get("source") for m in metadatas if m})

        if chat_id is not None:
            chats.add_messages(
                GENERAL_CHAT_BUCKET,
                chat_id,
                [{"role": "user", "text": question}, {"role": "ai", "text": answer}],
            )

        return {"question": question, "answer": answer, "sources": sources, "chat_id": chat_id}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ask failed: {exc}")


# ── General chat persistence (bucket 0) ───────────────────────────────────────

@app.get("/chats")
def list_general_chats():
    return {"chats": chats.list_chats(GENERAL_CHAT_BUCKET)}


@app.post("/chats")
def new_general_chat():
    chat = chats.create_chat(GENERAL_CHAT_BUCKET)
    return {"id": chat["id"], "title": chat["title"]}


@app.get("/chats/{chat_id}")
def get_general_chat(chat_id: str):
    chat = chats.get_chat(GENERAL_CHAT_BUCKET, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@app.delete("/chats/{chat_id}")
def delete_general_chat(chat_id: str):
    if not chats.delete_chat(GENERAL_CHAT_BUCKET, chat_id):
        raise HTTPException(status_code=404, detail="Chat not found.")
    return {"success": True}


# ── Sources ───────────────────────────────────────────────────────────────────

def _file_size(name: str):
    if name.startswith(("http://", "https://")):
        return None
    try:
        path = UPLOAD_DIR / Path(name).name
        return path.stat().st_size if path.is_file() else None
    except OSError:
        return None


@app.get("/sources")
def get_sources():
    items = list_sources()
    for item in items:
        item["size_bytes"] = _file_size(item["name"])
    return {"sources": items}


@app.get("/sources/content")
def source_content(name: str, limit: int = 20):
    chunks = get_source_chunks(name, max(1, min(limit, 100)))
    if not chunks:
        raise HTTPException(status_code=404, detail="Source not found.")
    return {"name": name, "chunks": chunks}


@app.delete("/sources")
def remove_source(name: str):
    removed = delete_source(name)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Source not found.")

    if not name.startswith(("http://", "https://")):
        try:
            (UPLOAD_DIR / Path(name).name).unlink(missing_ok=True)
        except OSError:
            pass

    from_classrooms = classrooms.remove_source_everywhere(name)
    return {"success": True, "removed_chunks": removed, "removed_from_classrooms": from_classrooms}


# ── Classrooms ────────────────────────────────────────────────────────────────

NOT_FOUND_IN_CLASSROOM = "I could not find this in the {name} Knowledge Base."


class ImportRequest(BaseModel):
    names: list[str]






class ChatSourceRequest(BaseModel):
    question: str
    classroom_ids: list[int] = []
    sources: list[str] = []
    chat_id: str | None = None
    n_results: int = 5






def _classroom(classroom_id: int):
    if not classrooms.is_valid(classroom_id):
        raise HTTPException(status_code=404, detail="Classroom not found.")
    return classrooms.get_classroom(classroom_id)


@app.get("/classrooms")
def get_classrooms():
    return {"classrooms": classrooms.list_classrooms()}







@app.post("/chat/ask")
def chat_with_selected_sources(body: ChatSourceRequest):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    if body.chat_id and chats.get_chat(GENERAL_CHAT_BUCKET, body.chat_id) is None:
        raise HTTPException(status_code=404, detail="Chat not found.")

    if any(not classrooms.is_valid(i) for i in body.classroom_ids):
        raise HTTPException(status_code=400, detail="Invalid classroom ID.")

    selected = set(body.sources)
    for cid in body.classroom_ids:
        selected.update(classrooms.get_sources(cid))

    if body.sources:
        known = {s["name"] for s in list_sources()}
        if not set(body.sources).issubset(known):
            raise HTTPException(status_code=400, detail="Unknown Knowledge Base document.")

    results = search(
        question,
        n_results=max(1, min(body.n_results, 10)),
        sources=sorted(selected) if selected else (
            [] if body.classroom_ids or body.sources else None
        ),
    )
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    answer = (
        generate_answer(question, documents)
        if documents else "No matching documents found in the selected sources."
    )
    sources = sorted({m["source"] for m in metadatas if m.get("source")})

    if body.chat_id:
        chats.add_messages(
            GENERAL_CHAT_BUCKET, body.chat_id,
            [{"role": "user", "text": question}, {"role": "ai", "text": answer}],
        )

    return {
        "question": question,
        "answer": answer,
        "sources": sources,
        "chat_id": body.chat_id,
    }





class ClassroomRequest(BaseModel):
    name: str


@app.post("/classrooms")
def create_classroom(body: ClassroomRequest):
    classroom_id, error = classrooms.create_classroom(body.name)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return classrooms.get_classroom(classroom_id)


@app.patch("/classrooms/{classroom_id}")
def rename_classroom(classroom_id: int, body: ClassroomRequest):
    success, error = classrooms.rename_classroom(classroom_id, body.name)
    if not success:
        status = 404 if error == "Classroom not found." else 400
        raise HTTPException(status_code=status, detail=error)
    return classrooms.get_classroom(classroom_id)


@app.delete("/classrooms/{classroom_id}")
def delete_classroom(classroom_id: int):
    _classroom(classroom_id)
    classrooms.delete_classroom(classroom_id)
    chats.delete_classroom_chats(classroom_id)
    return {"success": True}







@app.get("/classrooms/{classroom_id}/documents")
def classroom_documents(classroom_id: int):
    room = _classroom(classroom_id)
    allowed = set(classrooms.get_sources(classroom_id))
    items = [item for item in list_sources() if item["name"] in allowed]
    for item in items:
        item["size_bytes"] = _file_size(item["name"])
    return {"classroom": room, "documents": items}


@app.post("/classrooms/{classroom_id}/documents")
def import_documents(classroom_id: int, body: ImportRequest):
    _classroom(classroom_id)
    names = list(dict.fromkeys(body.names))
    if not names:
        raise HTTPException(status_code=400, detail="Select at least one document.")

    known = {item["name"] for item in list_sources()}
    unknown = [n for n in names if n not in known]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Not in the Knowledge Base: {', '.join(unknown)}",
        )

    added, skipped = classrooms.add_sources(classroom_id, names)
    return {"success": True, "added": added, "skipped": skipped}


@app.delete("/classrooms/{classroom_id}/documents")
def remove_classroom_document(classroom_id: int, name: str):
    _classroom(classroom_id)
    if not classrooms.remove_source(classroom_id, name):
        raise HTTPException(status_code=404, detail="Document is not in this classroom.")
    return {"success": True, "removed": name}


@app.post("/classrooms/{classroom_id}/upload")
async def classroom_upload(classroom_id: int, file: UploadFile = File(...)):
    _classroom(classroom_id)
    result = await upload_file(file)
    added, skipped = classrooms.add_sources(classroom_id, [result["filename"]])
    return {**result, "classroom_id": classroom_id, "added": added, "skipped": skipped}


# NOTE: /classrooms/multi/ask must be registered BEFORE /classrooms/{classroom_id}/...
# routes so FastAPI matches the static segment "multi" first.
@app.get("/classrooms/multi/ask")
def multi_classroom_ask(
    classroom_ids: str,
    question: str,
    n_results: int = 3,
    chat_id: str | None = None,
):
    """Ask across several classrooms with deduplication. Persists to the general chat bucket."""
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    if chat_id is not None and chats.get_chat(GENERAL_CHAT_BUCKET, chat_id) is None:
        raise HTTPException(status_code=404, detail="Chat not found.")

    try:
        ids = [int(i.strip()) for i in classroom_ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid classroom_ids.")

    ids = [i for i in ids if classrooms.is_valid(i)]
    if not ids:
        raise HTTPException(status_code=400, detail="No valid classroom IDs.")

    seen: set[str] = set()
    unique_sources: list[str] = []
    for cid in ids:
        for src in classrooms.get_sources(cid):
            if src not in seen:
                seen.add(src)
                unique_sources.append(src)

    room_names = [classrooms.get_classroom(cid)["name"] for cid in ids]
    scope = " + ".join(room_names)

    try:
        results = search(
            question,
            n_results=max(1, min(n_results, 10)),
            sources=unique_sources,
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if documents:
            answer = generate_answer(question, documents, scope=f"the {scope} Knowledge Base")
            sources = sorted({m.get("source") for m in metadatas if m})
        else:
            answer = f"I could not find this in {scope}."
            sources = []

        if chat_id is not None:
            chats.add_messages(
                GENERAL_CHAT_BUCKET,
                chat_id,
                [{"role": "user", "text": question}, {"role": "ai", "text": answer}],
            )

        return {
            "question": question,
            "classroom_ids": ids,
            "answer": answer,
            "sources": sources,
            "chat_id": chat_id,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ask failed: {exc}")


@app.get("/classrooms/{classroom_id}/search")
def classroom_search(classroom_id: int, query: str, n_results: int = 3):
    _classroom(classroom_id)
    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        r = search(
            query,
            n_results=max(1, min(n_results, 10)),
            sources=classrooms.get_sources(classroom_id),
        )
        docs = r.get("documents", [[]])[0]
        metas = r.get("metadatas", [[]])[0]
        dists = r.get("distances", [[]])[0]
        return {
            "query": query,
            "classroom_id": classroom_id,
            "results": [
                {"text": d, "source": m.get("source"), "type": m.get("type"), "distance": x}
                for d, m, x in zip(docs, metas, dists)
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")


@app.get("/classrooms/{classroom_id}/ask")
def classroom_ask(
    classroom_id: int,
    question: str,
    n_results: int = 3,
    chat_id: str | None = None,
):
    room = _classroom(classroom_id)
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    if chat_id is not None and chats.get_chat(classroom_id, chat_id) is None:
        raise HTTPException(status_code=404, detail="Chat not found in this classroom.")

    not_found = NOT_FOUND_IN_CLASSROOM.format(name=room["name"])

    try:
        results = search(
            question,
            n_results=max(1, min(n_results, 10)),
            sources=classrooms.get_sources(classroom_id),
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if documents:
            answer = generate_answer(question, documents, scope=f"the {room['name']} Knowledge Base")
            sources = sorted({m.get("source") for m in metadatas if m})
        else:
            answer, sources = not_found, []

        if chat_id is not None:
            chats.add_messages(
                classroom_id,
                chat_id,
                [{"role": "user", "text": question}, {"role": "ai", "text": answer}],
            )

        return {
            "question": question,
            "classroom_id": classroom_id,
            "chat_id": chat_id,
            "answer": answer,
            "sources": sources,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ask failed: {exc}")












@app.post("/classrooms/{classroom_id}/quiz")
def create_quiz(classroom_id: int, body: QuizRequest):
    _classroom(classroom_id)

    names = classrooms.get_sources(classroom_id)
    if body.document_names:
        names = [n for n in names if n in body.document_names]
    if not names:
        raise HTTPException(status_code=400, detail="Upload documents first.")

    chunks_by_doc = {
        n: [{"text": t} for t in get_source_chunks(n, limit=200)]
        for n in names
    }
    chunks = sample_chunks(chunks_by_doc, body.num_questions + 2)
    if not chunks:
        raise HTTPException(
            status_code=400, detail="These documents have no readable text."
        )

    try:
        questions = generate_questions(call_groq_json, chunks, body)
    except Exception as exc:
        print("Quiz generation failed:", exc)
        raise HTTPException(
            status_code=502,
            detail="The AI service failed or is rate-limited. Try again in a minute.",
        )

    if not questions:
        raise HTTPException(
            status_code=502, detail="Could not generate the quiz. Please try again."
        )
    return {"questions": questions}







@app.post("/quiz/attempts")
def save_quiz_attempt(body: QuizAttemptRequest):
    classroom = _classroom(body.classroom_id)
    if not body.questions or len(body.answers) != len(body.questions):
        raise HTTPException(
            status_code=400, detail="Answers must match the questions."
        )
    settings = {
        "document_names": body.document_names,
        "difficulty": body.difficulty,
        "include_true_false": body.include_true_false,
    }
    name = classroom.get("name", f"Classroom {body.classroom_id}")
    return quiz_store.save_attempt(
        body.classroom_id, name, settings, body.questions, body.answers
    )


@app.get("/quiz/attempts")
def list_quiz_attempts(limit: int = 50):
    return {"attempts": quiz_store.list_attempts(min(max(limit, 1), 200))}


@app.get("/quiz/attempts/{attempt_id}")
def get_quiz_attempt(attempt_id: str):
    attempt = quiz_store.get_attempt(attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    return attempt












    


@app.get("/classrooms/{classroom_id}/chats")
def classroom_chats(classroom_id: int):
    _classroom(classroom_id)
    return {"chats": chats.list_chats(classroom_id)}


@app.post("/classrooms/{classroom_id}/chats")
def new_classroom_chat(classroom_id: int):
    _classroom(classroom_id)
    chat = chats.create_chat(classroom_id)
    return {"id": chat["id"], "title": chat["title"]}


@app.get("/classrooms/{classroom_id}/chats/{chat_id}")
def get_classroom_chat(classroom_id: int, chat_id: str):
    _classroom(classroom_id)
    chat = chats.get_chat(classroom_id, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found in this classroom.")
    return chat


@app.delete("/classrooms/{classroom_id}/chats/{chat_id}")
def delete_classroom_chat(classroom_id: int, chat_id: str):
    _classroom(classroom_id)
    if not chats.delete_chat(classroom_id, chat_id):
        raise HTTPException(status_code=404, detail="Chat not found in this classroom.")
    return {"success": True}
