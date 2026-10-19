"""
Test setup. Run from the project root (venv on):

    pip install pytest httpx
    # create an EMPTY database whose name ends in _test (e.g. mybookai_test) in pgAdmin, then:
    set TEST_DATABASE_URL=postgresql+psycopg2://postgres:PASSWORD@localhost:5432/mybookai_test     (Windows cmd)
    export TEST_DATABASE_URL=postgresql+psycopg2://postgres:PASSWORD@localhost:5432/mybookai_test  (macOS / Linux)
    python -m pytest backend/tests -v

The tests WIPE the schema of that database, so the name must end in "_test".
The embedding model and the Groq LLM are replaced by small fakes: the tests are fast,
need no internet, and never touch real uploads or the real faiss_db folder
(every test uses its own temporary folder).
"""

import itertools
import json
import os
import re
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

PASSWORD = "password123"


# ── fakes ─────────────────────────────────────────────────────────────────────

class FakeLLM:
    """Stands in for generate_answer(question, chunks, scope=...). Records every call."""

    def __init__(self):
        self.calls = []  # list of chunk lists that were "sent to the LLM"

    def __call__(self, question, chunks, scope="your documents"):
        self.calls.append(list(chunks))
        return "fake answer"

    @property
    def sent_text(self):
        return " ".join(c for call in self.calls for c in call)


def fake_quiz_llm(prompt):
    """Stands in for call_groq_json(prompt): always returns 5 valid questions about chunk C1."""
    questions = [
        {
            "type": "mcq",
            "question": f"Question number {i}?",
            "options": ["one", "two", "three", "four"],
            "answer_index": 0,
            "explanation": "Because the text says so.",
            "chunk": "C1",
        }
        for i in range(5)
    ]
    return json.dumps({"questions": questions})


def csv_text(sentence, rows=3, repeat=1):
    """A tiny CSV whose rows all contain `sentence` (one clearly different word per document)."""
    lines = ["topic,notes"]
    for i in range(rows):
        lines.append(f"item{i}," + " ".join([sentence] * repeat))
    return "\n".join(lines) + "\n"


# ── one logged-in user ────────────────────────────────────────────────────────

class ApiUser:
    def __init__(self, client, token, user_id, upload_dir):
        self.client = client
        self.token = token
        self.id = user_id
        self.upload_dir = upload_dir

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, url, **kw):
        return self.client.get(url, headers=self.headers, **kw)

    def post(self, url, **kw):
        return self.client.post(url, headers=self.headers, **kw)

    def patch(self, url, **kw):
        return self.client.patch(url, headers=self.headers, **kw)

    def delete(self, url, **kw):
        return self.client.delete(url, headers=self.headers, **kw)

    # shortcuts used by many tests
    def upload(self, name, sentence, rows=3, repeat=1):
        r = self.post(
            "/upload",
            files={"file": (name, csv_text(sentence, rows, repeat).encode(), "text/csv")},
        )
        assert r.status_code == 200, r.text
        return r.json()["document_id"]

    def new_room(self, name="Room"):
        r = self.post("/classrooms", json={"name": name})
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def import_docs(self, room_id, document_ids):
        return self.post(f"/classrooms/{room_id}/documents", json={"document_ids": document_ids})

    def ask(self, question, **extra):
        return self.post("/chat/ask", json={"question": question, "n_results": 10, **extra})

    def source_names(self):
        return sorted(s["name"] for s in self.get("/sources").json()["sources"])

    def room_doc_names(self, room_id):
        r = self.get(f"/classrooms/{room_id}/documents")
        assert r.status_code == 200, r.text
        return sorted(d["name"] for d in r.json()["documents"])


class Api:
    def __init__(self, client, llm, upload_dir):
        self.client = client
        self.llm = llm
        self.upload_dir = upload_dir
        self._counter = itertools.count(1)

    def user(self):
        n = next(self._counter)
        r = self.client.post(
            "/auth/register",
            json={"name": f"User {n}", "email": f"user{n}@school.org", "password": PASSWORD},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        return ApiUser(self.client, data["access_token"], data["user"]["id"], self.upload_dir)


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def backend():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an empty *_test database to run these tests.")

    name = make_url(url).database or ""
    if not name.endswith("_test"):
        pytest.fail(
            "TEST_DATABASE_URL must point at a database whose name ends with _test "
            "(the tests wipe it).",
            pytrace=False,
        )

    # Must be set BEFORE backend.database is imported, so the app uses the test database.
    os.environ["DATABASE_URL"] = url
    os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

    from types import SimpleNamespace

    from backend import database, models  # noqa: F401  (models registers the tables)
    import backend.main as main
    import backend.vector_store as vs

    def reset_schema():
        with database.engine.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))

    reset_schema()
    database.Base.metadata.create_all(database.engine)

    yield SimpleNamespace(database=database, main=main, vs=vs)

    reset_schema()


@pytest.fixture
def api(backend, tmp_path, monkeypatch):
    vs, main = backend.vs, backend.main

    with backend.database.engine.begin() as conn:
        conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))

    def fake_embed(texts, is_query=False):
        out = np.zeros((len(texts), vs.DIM), dtype="float32")
        for row, t in enumerate(texts):
            for word in re.findall(r"\w+", t.lower()):
                out[row, zlib.crc32(word.encode()) % vs.DIM] += 1
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return out / norms

    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()

    llm = FakeLLM()
    monkeypatch.setattr(vs, "DB_DIR", str(tmp_path / "faiss"))
    monkeypatch.setattr(vs, "_embed", fake_embed)
    monkeypatch.setattr(main, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(main, "generate_answer", llm)
    monkeypatch.setattr(main, "call_groq_json", fake_quiz_llm)

    return Api(TestClient(main.app), llm, upload_dir)