import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.vector_store import (
    add_document,
    delete_source,
    get_source_chunks,
    list_sources,
    search,
)
from backend.llm.generate_answer import generate_answer
from backend.excel.parse_excel import parse_excel
from backend.ppt.parse_ppt import parse_ppt
from backend.word.parse_word import parse_word
from backend.pdf.parse_pdf import parse_pdf
from backend.website.scrape import scrape_website, normalize_url

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

# file extension -> (parser function, type stored in the vector DB)
PARSERS = {
    ".pdf": (parse_pdf, "pdf"),
    ".docx": (parse_word, "word"),
    ".pptx": (parse_ppt, "ppt"),
    ".xlsx": (parse_excel, "excel"),
    ".xlsm": (parse_excel, "excel"),
    ".xltx": (parse_excel, "excel"),
    ".xls": (parse_excel, "excel"),
    ".csv": (parse_excel, "excel"),
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
        text = parser(str(file_path))
        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text found.")

        chunks = add_document(text, filename, doc_type)
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
        text = scrape_website(url)
        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text found.")
        chunks = add_document(text, url, "website")
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

    return {"success": True, "removed_chunks": removed}