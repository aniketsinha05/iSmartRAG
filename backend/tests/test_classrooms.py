"""
Run from the project root (venv on):
    pip install pytest httpx
    python -m pytest backend/tests -v

The embedding model and the Groq LLM are replaced by small fakes, so the tests are fast
and need no internet. Real files are not touched: every test uses a temporary folder.
"""

import re
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

import backend.chats as chats
import backend.classrooms as cr
import backend.main as main
import backend.vector_store as vs

# one clearly different word per document
DOCS = {
    "A.txt": "alpha apples orchard harvest",
    "B.txt": "beta bananas plantation harvest",
    "C.txt": "gamma cherries blossom festival",
    "D.txt": "delta dates oasis caravan",
    "E.txt": "epsilon elderberries hedgerow jam",
}


def fake_embed(texts, is_query=False):
    out = np.zeros((len(texts), vs.DIM), dtype="float32")
    for row, text in enumerate(texts):
        for word in re.findall(r"\w+", text.lower()):
            out[row, zlib.crc32(word.encode()) % vs.DIM] += 1
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return out / norms


class FakeLLM:
    def __init__(self):
        self.calls = []

    def __call__(self, question, chunks, scope="your documents"):
        self.calls.append(list(chunks))
        return "fake answer"


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setattr(vs, "META_PATH", str(tmp_path / "records.json"))
    monkeypatch.setattr(vs, "VEC_PATH", str(tmp_path / "vectors.npy"))
    monkeypatch.setattr(vs, "INDEX_PATH", str(tmp_path / "index.faiss"))
    monkeypatch.setattr(vs, "_embed", fake_embed)
    monkeypatch.setattr(cr, "PATH", str(tmp_path / "classrooms.json"))
    monkeypatch.setattr(chats, "PATH", str(tmp_path / "chats.json"))
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

    llm = FakeLLM()
    monkeypatch.setattr(main, "generate_answer", llm)

    for name, text in DOCS.items():  # the common Knowledge Base holds A to E
        vs.add_document(text, name, "test")

    client = TestClient(main.app)
    client.llm = llm
    return client


def import_docs(client, classroom_id, names):
    return client.post(f"/classrooms/{classroom_id}/documents", json={"names": names})


def room_docs(client, classroom_id):
    r = client.get(f"/classrooms/{classroom_id}/documents")
    assert r.status_code == 200
    return sorted(d["name"] for d in r.json()["documents"])


def kb_docs(client):
    return sorted(d["name"] for d in client.get("/sources").json()["sources"])


# ---- Test A: retrieval isolation ------------------------------------------------------
def test_a_retrieval_isolation(env):
    import_docs(env, 1, ["A.txt", "B.txt"])
    import_docs(env, 2, ["C.txt", "D.txt"])

    # a question about Classroom 2's document, asked inside Classroom 1
    r = env.get("/classrooms/1/search", params={"query": "gamma cherries", "n_results": 10})
    assert {x["source"] for x in r.json()["results"]} <= {"A.txt", "B.txt"}

    r = env.get("/classrooms/1/ask", params={"question": "gamma cherries blossom", "n_results": 10})
    assert set(r.json()["sources"]) <= {"A.txt", "B.txt"}
    sent_to_llm = " ".join(c for call in env.llm.calls for c in call)
    for word in ("gamma", "delta", "epsilon"):
        assert word not in sent_to_llm

    # and it still finds its own documents
    r = env.get("/classrooms/1/search", params={"query": "alpha apples"})
    assert r.json()["results"][0]["source"] == "A.txt"


# ---- Test B: shared document ----------------------------------------------------------
def test_b_shared_document(env):
    import_docs(env, 1, ["A.txt"])
    import_docs(env, 2, ["A.txt", "C.txt"])

    assert room_docs(env, 1) == ["A.txt"]
    assert room_docs(env, 2) == ["A.txt", "C.txt"]

    for classroom_id in (1, 2):
        r = env.get(f"/classrooms/{classroom_id}/search", params={"query": "alpha apples"})
        assert r.json()["results"][0]["source"] == "A.txt"

    # no duplicate entry inside one classroom
    r = import_docs(env, 1, ["A.txt"])
    assert r.json()["added"] == [] and r.json()["skipped"] == ["A.txt"]
    assert room_docs(env, 1) == ["A.txt"]


# ---- Test C: safe deletion ------------------------------------------------------------
def test_c_safe_deletion(env):
    import_docs(env, 1, ["A.txt"])
    import_docs(env, 2, ["A.txt"])
    chunks_before = len(vs.get_source_chunks("A.txt"))

    r = env.delete("/classrooms/1/documents", params={"name": "A.txt"})
    assert r.status_code == 200

    assert room_docs(env, 1) == []
    assert room_docs(env, 2) == ["A.txt"]          # still in Classroom 2
    assert "A.txt" in kb_docs(env)                 # still in the main Knowledge Base
    assert len(vs.get_source_chunks("A.txt")) == chunks_before  # vectors untouched

    # removing it again is a 404, not a delete of the original
    assert env.delete("/classrooms/1/documents", params={"name": "A.txt"}).status_code == 404

    # permanent delete (main Knowledge Base) also clears the link everywhere
    r = env.delete("/sources", params={"name": "A.txt"})
    assert r.status_code == 200 and r.json()["removed_from_classrooms"] == 1
    assert room_docs(env, 2) == []
    assert "A.txt" not in kb_docs(env)


# ---- Test D: empty classroom ----------------------------------------------------------
def test_d_empty_classroom_has_no_fallback(env):
    assert kb_docs(env) == sorted(DOCS)  # the main Knowledge Base is full

    r = env.get("/classrooms/3/search", params={"query": "alpha apples"})
    assert r.json()["results"] == []

    r = env.get("/classrooms/3/ask", params={"question": "alpha apples orchard"})
    body = r.json()
    assert "could not find" in body["answer"].lower() and "Classroom 3" in body["answer"]
    assert body["sources"] == []
    assert env.llm.calls == []  # the LLM was never called

    # the main (global) search still works as before
    r = env.get("/search", params={"query": "alpha apples"})
    assert r.json()["results"][0]["source"] == "A.txt"


# ---- Test E: security / server-side rules ---------------------------------------------
@pytest.mark.parametrize("bad_id", [0, 6, 99, -1])
def test_e_invalid_classroom_id(env, bad_id):
    assert env.get(f"/classrooms/{bad_id}/documents").status_code == 404
    assert import_docs(env, bad_id, ["A.txt"]).status_code == 404
    assert env.delete(f"/classrooms/{bad_id}/documents", params={"name": "A.txt"}).status_code == 404
    assert env.get(f"/classrooms/{bad_id}/search", params={"query": "x"}).status_code == 404
    assert env.get(f"/classrooms/{bad_id}/ask", params={"question": "x"}).status_code == 404


def test_e_cannot_link_unknown_document(env):
    r = import_docs(env, 1, ["A.txt", "not-in-kb.pdf"])
    assert r.status_code == 400
    assert room_docs(env, 1) == []  # nothing was added, not even A.txt


def test_e_client_cannot_widen_the_scope(env):
    import_docs(env, 1, ["A.txt"])

    # extra query parameters are ignored: the allowed documents come from the server
    r = env.get(
        "/classrooms/1/ask",
        params={"question": "gamma cherries", "sources": "C.txt", "classroom_id": 2, "n_results": 10},
    )
    assert set(r.json()["sources"]) <= {"A.txt"}
    assert all("gamma" not in c for call in env.llm.calls for c in call)


# ---- extra: upload straight into a classroom, and the list of classrooms ---------------
def test_upload_into_classroom(env):
    r = env.post(
        "/classrooms/4/upload",
        files={"file": ("sheet.csv", b"Name,City\nAsha,Pune\nRavi,Delhi\n", "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["added"] == ["sheet.csv"]

    assert room_docs(env, 4) == ["sheet.csv"]
    assert "sheet.csv" in kb_docs(env)  # also in the main Knowledge Base, stored once
    assert room_docs(env, 1) == []


def test_five_classrooms(env):
    rooms = env.get("/classrooms").json()["classrooms"]
    assert [r["name"] for r in rooms] == [f"Classroom {i}" for i in range(1, 6)]


# ---- chat history is saved on the backend, per classroom -------------------------------
def new_chat(client, classroom_id):
    r = client.post(f"/classrooms/{classroom_id}/chats")
    assert r.status_code == 200
    return r.json()["id"]


def test_chat_is_saved_and_loaded(env):
    import_docs(env, 1, ["A.txt"])
    chat_id = new_chat(env, 1)

    r = env.get("/classrooms/1/ask", params={"question": "alpha apples", "chat_id": chat_id})
    assert r.status_code == 200 and r.json()["chat_id"] == chat_id
    env.get("/classrooms/1/ask", params={"question": "alpha harvest", "chat_id": chat_id})

    chat = env.get(f"/classrooms/1/chats/{chat_id}").json()
    assert [m["role"] for m in chat["messages"]] == ["user", "ai", "user", "ai"]
    assert chat["messages"][0]["text"] == "alpha apples"
    assert chat["title"] == "alpha apples"

    listing = env.get("/classrooms/1/chats").json()["chats"]
    assert [c["id"] for c in listing] == [chat_id] and listing[0]["message_count"] == 4

    # asking without a chat id does not save anything
    env.get("/classrooms/1/ask", params={"question": "alpha apples"})
    assert len(env.get(f"/classrooms/1/chats/{chat_id}").json()["messages"]) == 4


def test_chats_belong_to_one_classroom(env):
    chat_id = new_chat(env, 1)

    assert env.get("/classrooms/2/chats").json()["chats"] == []
    assert env.get(f"/classrooms/2/chats/{chat_id}").status_code == 404
    assert env.delete(f"/classrooms/2/chats/{chat_id}").status_code == 404

    # a chat of Classroom 1 cannot be used to ask in Classroom 2
    r = env.get("/classrooms/2/ask", params={"question": "alpha", "chat_id": chat_id})
    assert r.status_code == 404
    assert env.llm.calls == []
    assert env.get(f"/classrooms/1/chats/{chat_id}").json()["messages"] == []


def test_delete_chat_and_removing_documents_keeps_chats(env):
    import_docs(env, 1, ["A.txt"])
    chat_id = new_chat(env, 1)
    env.get("/classrooms/1/ask", params={"question": "alpha apples", "chat_id": chat_id})

    # removing a document from the classroom does not delete the chat history
    env.delete("/classrooms/1/documents", params={"name": "A.txt"})
    assert len(env.get(f"/classrooms/1/chats/{chat_id}").json()["messages"]) == 2

    assert env.delete(f"/classrooms/1/chats/{chat_id}").status_code == 200
    assert env.get("/classrooms/1/chats").json()["chats"] == []


def test_chat_in_empty_classroom_is_saved_with_not_found_answer(env):
    chat_id = new_chat(env, 3)
    r = env.get("/classrooms/3/ask", params={"question": "alpha", "chat_id": chat_id})

    assert "could not find" in r.json()["answer"].lower()
    assert len(env.get(f"/classrooms/3/chats/{chat_id}").json()["messages"]) == 2
    assert env.llm.calls == []


@pytest.mark.parametrize("bad_id", [0, 6])
def test_chat_endpoints_reject_invalid_classroom(env, bad_id):
    assert env.get(f"/classrooms/{bad_id}/chats").status_code == 404
    assert env.post(f"/classrooms/{bad_id}/chats").status_code == 404