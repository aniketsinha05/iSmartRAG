from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from vector_store import add_document
import io

app = FastAPI(title="iSmartRAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "iSmartRAG backend is running"
    }


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        return {
            "success": False,
            "message": "Only PDF files are supported."
        }

    pdf_bytes = await file.read()

    reader = PdfReader(io.BytesIO(pdf_bytes))

    text = ""

    for page in reader.pages:
        page_text = page.extract_text() or ""
        text += page_text + "\n"

    if not text.strip():
        return {
            "success": False,
            "message": "No readable text was found in the PDF."
        }

    chunks_added = add_document(
        text=text,
        source=file.filename,
        doc_type="pdf"
    )

    return {
        "success": True,
        "filename": file.filename,
        "pages": len(reader.pages),
        "text_length": len(text),
        "chunks": chunks_added,
        "message": "PDF uploaded, processed and stored in ChromaDB."
    }