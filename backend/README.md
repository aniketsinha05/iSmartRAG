# iSmartRAG Backend

FastAPI backend for iSmartRAG. It reads documents, stores them in a FAISS vector database, and answers questions with an LLM.

## Structure

```
backend/
  main.py             API endpoints only
  vector_store.py     FAISS: add_document(), search()
  llm/
    generate_answer.py  Groq LLM call
  pdf/parse_pdf.py        PDF -> text
  word/parse_word.py      Word -> text
  ppt/parse_ppt.py        PowerPoint -> text
  excel/parse_excel.py    Excel/CSV -> text
  website/scrape.py       Website -> text
  requirements.txt
```

- Each parser has a function that returns text, and can also run from the command line.
- `main.py` imports these parsers. It does not contain parsing code.
- Every folder has an `__init__.py`, so run everything from the **project root**.

## Setup

```
pip install -r backend/requirements.txt
playwright install chromium
```

Create a `.env` file in the project root (not inside `backend`):

```
GROQ_API_KEY=your_key_here
```

## Run

From the project root:

```
python -m uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000/docs to test the endpoints.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/` | API running message |
| GET | `/health` | Health check |
| POST | `/upload` | Upload a PDF, Word, PowerPoint or Excel file and add it to the knowledge base |
| POST | `/website` | Scrape a website (`url` parameter) and add it |
| GET | `/search` | Find the most similar chunks (`query`, `n_results`) |
| GET | `/ask` | Ask a question (`question`, `n_results`). Returns an answer and its sources |

## Vector store

- FAISS (`IndexFlatIP`) with normalized vectors (cosine similarity).
- Text is split into chunks of 800 characters with 100 overlap.
- Data is saved in `backend/faiss_db/` (ignored by Git).
- Uploading the same file again replaces its old chunks.

## LLM

`/ask` searches the vector store, then sends the top chunks and the question to Groq (`openai/gpt-oss-120b`). The answer uses only the given context. To change the model, edit `MODEL` in `llm/generate_answer.py`.

## Notes

- Never commit `.env`.
- Legacy `.doc` and `.ppt` files are not supported. Use `.docx` and `.pptx`.