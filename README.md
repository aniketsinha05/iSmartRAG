# iSmartRAG

iSmartRAG is a study assistant. You upload your own study material (PDF, Word, PowerPoint, Excel) or add a website, and then ask questions. The answers come only from your own documents.

## How it works

1. **Upload**: the backend reads the file and splits the text into small chunks.
2. **Store**: each chunk is turned into a vector and saved in a FAISS vector database.
3. **Ask**: your question is matched with the most similar chunks, and an LLM (Groq) writes the answer using only those chunks.

## Tech stack

| Part | Technology |
|---|---|
| Backend | Python, FastAPI |
| Vector database | FAISS |
| LLM | Groq |
| Frontend | React, Vite, TypeScript |

## Project structure

```
iSmartRAG/
  backend/    FastAPI app, parsers, vector store, LLM (see backend/README.md)
  frontend/   React app
```

## Quick start

### 1. Backend

```
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
playwright install chromium
```

Create a `.env` file in the project root:

```
GROQ_API_KEY=your_key_here
```

Run from the project root:

```
python -m uvicorn backend.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (second terminal)

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The backend must be running.

## Notes

- Never commit your `.env` file.
- Run backend commands from the project root.