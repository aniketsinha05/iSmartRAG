# MyBookAI Backend

FastAPI backend for MyBookAI. Users register and log in, upload documents (or websites), organise them into classrooms, chat with them, and take AI-generated quizzes. **Every piece of data belongs to one user.** Nobody can see, search, change or delete another user's data.

## How it works

- **Auth:** JWT (bcrypt password hashing). Every endpoint except `/`, `/health`, `/auth/register` and `/auth/login` needs `Authorization: Bearer <token>`. A missing or invalid token returns 401.
- **PostgreSQL** stores users, documents, chunks, classrooms, chats, messages and quiz attempts. Tables are created by Alembic.
- **FAISS** stores the vectors (`IndexFlatIP`, normalized vectors = cosine similarity), one file per user. A search only loads the current user's vectors, then checks ownership again in SQL.
- **Documents are identified by their database `id`**, never by file name. Two users can upload files with the same name without clashing.
- **Groq LLM** (`openai/gpt-oss-120b`) writes answers and quiz questions from the retrieved chunks only.

## Structure

```
backend/
  main.py             API endpoints (all authenticated)
  auth.py             /auth/register, /auth/login, /auth/me
  security.py         password hashing, JWT create/decode
  dependencies.py     get_current_user
  database.py         engine, session, get_db
  models.py           SQLAlchemy tables
  classrooms.py       classroom + classroom-document logic (per user)
  chats.py            chat history (per user)
  quiz.py             quiz prompt building, validation
  quiz_store.py       saved quiz attempts (per user)
  vector_store.py     chunking, embeddings, FAISS add/search/delete (per user)
  llm/generate_answer.py   Groq calls
  pdf/ word/ ppt/ excel/ website/   one parser per file type
  migrations/         Alembic (see migrations/README.md)
  tests/              pytest suite
  requirements.txt
```

Every folder has an `__init__.py`, so run everything from the **project root**.

## Setup

```
python -m venv venv
venv\Scripts\activate          # macOS / Linux: source venv/bin/activate
pip install -r backend/requirements.txt
playwright install chromium
```

Create an empty PostgreSQL database in pgAdmin 4 (for example `mybookai`), then create a `.env` file in the **project root** (not inside `backend/`):

```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/mybookai
SECRET_KEY=a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GROQ_API_KEY=your_key_here
```

- Special characters in the password must be URL-encoded (`@` becomes `%40`).
- Generate a secret with `python -c "import secrets; print(secrets.token_hex(32))"`.
- Never commit `.env`.

Create the tables:

```
cd backend
alembic upgrade head
cd ..
```

More detail and troubleshooting: `backend/migrations/README.md`.

## Run

From the project root:

```
python -m uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000/docs. Click **Authorize** and paste a token from `/auth/login` to try the protected endpoints.

For the frontend, open http://localhost:5173 (use `localhost`, not `127.0.0.1`, because of CORS).

## Endpoints

All of these need a token except the first four.

| Method | Path | What it does |
|---|---|---|
| GET | `/`, `/health` | API running / health check (public) |
| POST | `/auth/register`, `/auth/login` | Create an account / log in (public). Returns a token |
| GET | `/auth/me` | The logged-in user |
| POST | `/upload` | Upload PDF, DOCX, PPTX, XLSX/XLSM/XLTX/XLS or CSV |
| POST | `/website?url=` | Scrape a website and index it |
| GET | `/sources` | Your documents (with `id`, type, chunks, size, date) |
| GET | `/sources/{id}/content` | First chunks of a document |
| DELETE | `/sources/{id}` | Delete a document everywhere (chunks, vectors, file, classroom links) |
| GET | `/search?query=` | Most similar chunks across your documents |
| GET | `/ask?question=` | Answer from all your documents |
| POST | `/chat/ask` | Answer with an optional filter: `classroom_ids`, `document_ids`, `chat_id` |
| GET / POST | `/chats` | List / create chats |
| GET / DELETE | `/chats/{chat_id}` | Read / delete a chat |
| GET / POST | `/classrooms` | List / create classrooms (max 20 per user) |
| PATCH / DELETE | `/classrooms/{id}` | Rename / delete a classroom |
| GET / POST | `/classrooms/{id}/documents` | List / add documents (`{"document_ids": [...]}`) |
| DELETE | `/classrooms/{id}/documents/{doc_id}` | Remove a document from the classroom only |
| POST | `/classrooms/{id}/upload` | Upload a file straight into a classroom |
| POST | `/classrooms/{id}/quiz` | Generate a quiz |
| POST / GET | `/quiz/attempts` | Save / list quiz attempts |
| GET | `/quiz/attempts/{id}` | One attempt with questions and answers |

Another user's classroom, document, chat or attempt always returns 404 (or 400 when an id is sent in a request body).

## Data rules

- A classroom does not copy files. It links to documents in your Knowledge Base, so one document can be in several classrooms.
- Removing a document from a classroom only removes the link. Deleting it from the Knowledge Base removes it from every classroom.
- A chat filtered to a classroom or to specific documents only searches those documents. A classroom with no documents finds nothing. It does not fall back to all documents.
- Chats are saved per user. Deleting a classroom keeps your chats and documents.
- A quiz attempt keeps a copy of its questions and the classroom name. It can still be reviewed after the classroom is renamed or deleted.
- Re-uploading a file with the same name replaces that document (same id).

## Files on disk (git-ignored)

- `backend/uploads/user_<id>/` your uploaded files.
- `backend/faiss_db/user_<id>/vectors.npz` your vectors.

Old data from before the multi-user change (`classrooms.json`, `chats.json`, quiz JSON, old `faiss_db` files) is not used any more. Delete it and upload your files again.

## Vector store

- Text is split into chunks of 800 characters with 120 overlap (`RecursiveCharacterTextSplitter`).
- Embeddings: `BAAI/bge-small-en-v1.5` (384 dimensions), loaded the first time it is needed.
- PDF: one piece per page. Word: one piece per heading section. PowerPoint: one piece per slide. Excel/CSV: 5 rows per chunk with the header repeated. Website: one piece per heading section.

## LLM

`/ask` and `/chat/ask` search first, then send only the top chunks and the question to Groq. The answer uses only that context. To change the model, edit `MODEL` in `llm/generate_answer.py`.

## Tests

The tests use a real PostgreSQL database (so foreign keys and `ON DELETE CASCADE` behave like production). The embedding model and Groq are replaced by fakes, so they are fast and need no internet.

1. In pgAdmin create an **empty** database whose name ends in `_test`, for example `mybookai_test`.
2. Set `TEST_DATABASE_URL` (the tests wipe this database, so they refuse any name that does not end in `_test`):

```
set TEST_DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/mybookai_test      (Windows)
export TEST_DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/mybookai_test   (macOS / Linux)
```

3. From the project root:

```
pip install pytest httpx
python -m pytest backend/tests -v
```

Without `TEST_DATABASE_URL` the tests are skipped.

What is covered:

- **Auth:** register, login, `/auth/me`, wrong password, duplicate email, and a 401 for every protected route with no token or a bad token.
- **Documents and search:** one user never sees, searches, reads or deletes another's documents. The same file name for two users does not clash. Uploads are stored per user.
- **Classrooms:** private per user, 20-per-user limit, a user cannot link another user's document, classroom scope isolates retrieval, shared documents, safe deletion, and an empty classroom never falls back to all documents.
- **Chats:** saved and loaded, private per user, and a chat id from another user is refused.
- **Quizzes:** generate, save, review, private per user, and an attempt survives its classroom being deleted.

## Notes

- Never commit `.env`, `uploads/` or `faiss_db/`.
- Legacy `.doc` and `.ppt` files are not supported. Use `.docx` and `.pptx`.
- Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES`. The frontend sends the user back to the login page on a 401.