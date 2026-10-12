import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import classrooms
from backend.vector_store import (
    add_pieces,
    delete_source,
    get_source_chunks,
    list_sources,
    search,
)
from backend.llm.generate_answer import generate_answer
from backend.excel.parse_excel import parse_excel_pieces
from backend.ppt.parse_ppt import parse_ppt_pieces
from backend.word.parse_word import parse_word_pieces
from backend.pdf.parse_pdf import parse_pdf_pieces
from backend.website.scrape import scrape_website_pieces, normalize_url

app = FastAPI(title="MyBookAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# file extension -> (parser function that returns pieces, type stored in the vector DB)
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
def ask(question: str, n_results: int = 3):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    try:
        results = search(question, n_results=max(1, min(n_results, 10)))
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if not documents:
            return {
                "question": question,
                "answer": "No documents found. Please upload a file first.",
                "sources": [],
            }

        answer = generate_answer(question, documents)
        sources = sorted({m.get("source") for m in metadatas if m})

        return {"question": question, "answer": answer, "sources": sources}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ask failed: {exc}")

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

    # a deleted document must not stay linked to any classroom
    from_classrooms = classrooms.remove_source_everywhere(name)

    return {"success": True, "removed_chunks": removed, "removed_from_classrooms": from_classrooms}


# ---------------------------------------------------------------------------
# Classrooms: each classroom can only use the documents linked to it.
# The allowed documents are always read from the server, never from the request.
# ---------------------------------------------------------------------------

NOT_FOUND_IN_CLASSROOM = "I could not find this in the {name} Knowledge Base."


class ImportRequest(BaseModel):
    names: list[str]


def _classroom(classroom_id: int):
    if not classrooms.is_valid(classroom_id):
        raise HTTPException(status_code=404, detail="Classroom not found.")
    return classrooms.get_classroom(classroom_id)


@app.get("/classrooms")
def get_classrooms():
    return {"classrooms": classrooms.list_classrooms()}


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

    names = list(dict.fromkeys(body.names))  # remove repeats, keep order
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

    # only the link is removed; the file, chunks and vectors stay in the Knowledge Base
    if not classrooms.remove_source(classroom_id, name):
        raise HTTPException(status_code=404, detail="Document is not in this classroom.")

    return {"success": True, "removed": name}


@app.post("/classrooms/{classroom_id}/upload")
async def classroom_upload(classroom_id: int, file: UploadFile = File(...)):
    _classroom(classroom_id)

    # same pipeline as the main Knowledge Base, then link it to this classroom
    result = await upload_file(file)
    added, skipped = classrooms.add_sources(classroom_id, [result["filename"]])
    return {**result, "classroom_id": classroom_id, "added": added, "skipped": skipped}


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
def classroom_ask(classroom_id: int, question: str, n_results: int = 3):
    room = _classroom(classroom_id)

    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    not_found = NOT_FOUND_IN_CLASSROOM.format(name=room["name"])

    try:
        # an empty classroom searches nothing: there is no fallback to the main Knowledge Base
        results = search(
            question,
            n_results=max(1, min(n_results, 10)),
            sources=classrooms.get_sources(classroom_id),
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if not documents:
            return {"question": question, "classroom_id": classroom_id, "answer": not_found, "sources": []}

        answer = generate_answer(question, documents, scope=f"the {room['name']} Knowledge Base")
        sources = sorted({m.get("source") for m in metadatas if m})

        return {"question": question, "classroom_id": classroom_id, "answer": answer, "sources": sources}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ask failed: {exc}")