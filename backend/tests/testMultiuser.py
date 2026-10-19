"""
Multi-user tests. See conftest.py for how to run them.

The rule behind every test here: one user must never be able to see, change, search
or delete another user's data, and no endpoint (except /, /health and the two /auth
routes) works without a valid token.
"""

import pytest

from backend.tests.conftest import PASSWORD

# one clearly different word per document
DOCS = {
    "A.csv": "alpha apples orchard harvest",
    "B.csv": "beta bananas plantation harvest",
    "C.csv": "gamma cherries blossom festival",
    "D.csv": "delta dates oasis caravan",
    "E.csv": "epsilon elderberries hedgerow jam",
}


def seed(user):
    """Upload A..E for this user. Returns {file name: document id}."""
    return {name: user.upload(name, sentence) for name, sentence in DOCS.items()}


# ═════════════════════════════════════════════════════════════════════════════
# Auth
# ═════════════════════════════════════════════════════════════════════════════

def test_public_routes(api):
    assert api.client.get("/").status_code == 200
    assert api.client.get("/health").status_code == 200


PROTECTED = [
    ("GET", "/sources"),
    ("GET", "/sources/1/content"),
    ("DELETE", "/sources/1"),
    ("GET", "/search?query=x"),
    ("GET", "/ask?question=x"),
    ("POST", "/chat/ask"),
    ("GET", "/chats"),
    ("POST", "/chats"),
    ("GET", "/chats/abc"),
    ("DELETE", "/chats/abc"),
    ("GET", "/classrooms"),
    ("POST", "/classrooms"),
    ("PATCH", "/classrooms/1"),
    ("DELETE", "/classrooms/1"),
    ("GET", "/classrooms/1/documents"),
    ("POST", "/classrooms/1/documents"),
    ("DELETE", "/classrooms/1/documents/1"),
    ("POST", "/classrooms/1/upload"),
    ("POST", "/classrooms/1/quiz"),
    ("POST", "/upload"),
    ("POST", "/website?url=example.com"),
    ("POST", "/quiz/attempts"),
    ("GET", "/quiz/attempts"),
    ("GET", "/quiz/attempts/abc"),
]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_protected_routes_need_a_token(api, method, path):
    kwargs = {}
    if "upload" in path:
        kwargs["files"] = {"file": ("a.csv", b"x,y\n1,2\n", "text/csv")}
    elif method in ("POST", "PATCH"):
        kwargs["json"] = {}
    assert api.client.request(method, path, **kwargs).status_code == 401


def test_invalid_token_is_rejected(api):
    r = api.client.get("/sources", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_register_login_me(api):
    reg = api.client.post(
        "/auth/register",
        json={"name": "Asha", "email": "asha@school.org", "password": PASSWORD},
    )
    assert reg.status_code == 201
    assert reg.json()["user"]["email"] == "asha@school.org"

    login = api.client.post(
        "/auth/login", json={"email": "ASHA@school.org", "password": PASSWORD}
    )
    assert login.status_code == 200  # email is not case sensitive

    me = api.client.get(
        "/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["name"] == "Asha"


def test_wrong_password_and_duplicate_email(api):
    api.client.post(
        "/auth/register",
        json={"name": "Asha", "email": "asha@school.org", "password": PASSWORD},
    )
    bad = api.client.post(
        "/auth/login", json={"email": "asha@school.org", "password": "wrong-password"}
    )
    assert bad.status_code == 401

    dup = api.client.post(
        "/auth/register",
        json={"name": "Other", "email": "Asha@School.org", "password": PASSWORD},
    )
    assert dup.status_code == 400


# ═════════════════════════════════════════════════════════════════════════════
# Documents and search
# ═════════════════════════════════════════════════════════════════════════════

def test_documents_are_private(api):
    a, b = api.user(), api.user()
    doc_id = a.upload("A.csv", DOCS["A.csv"])

    assert b.source_names() == []
    assert b.get(f"/sources/{doc_id}/content").status_code == 404
    assert b.delete(f"/sources/{doc_id}").status_code == 404

    # A's document is untouched
    assert a.source_names() == ["A.csv"]
    assert a.get(f"/sources/{doc_id}/content").status_code == 200


def test_same_file_name_for_two_users(api):
    a, b = api.user(), api.user()
    a_id = a.upload("notes.csv", "alpha apples orchard harvest")
    b_id = b.upload("notes.csv", "gamma cherries blossom festival")
    assert a_id != b_id

    # each user only finds their own text
    for user, word, other in ((a, "alpha", "gamma"), (b, "gamma", "alpha")):
        r = user.get("/search", params={"query": f"{word} {word}", "n_results": 10})
        texts = " ".join(x["text"] for x in r.json()["results"])
        assert word in texts and other not in texts

    # deleting A's copy does not touch B's
    assert a.delete(f"/sources/{a_id}").status_code == 200
    assert b.source_names() == ["notes.csv"]
    assert b.get(f"/sources/{b_id}/content").status_code == 200


def test_search_and_ask_never_use_other_users_text(api):
    a, b = api.user(), api.user()
    a.upload("A.csv", DOCS["A.csv"])
    b.upload("C.csv", DOCS["C.csv"])

    r = b.get("/search", params={"query": "alpha apples orchard", "n_results": 10})
    assert "alpha" not in " ".join(x["text"] for x in r.json()["results"])

    b.get("/ask", params={"question": "alpha apples orchard", "n_results": 10})
    assert "alpha" not in api.llm.sent_text


def test_user_without_documents_gets_not_found_and_no_llm_call(api):
    a, b = api.user(), api.user()
    a.upload("A.csv", DOCS["A.csv"])

    r = b.get("/ask", params={"question": "alpha apples orchard"})
    assert "could not find" in r.json()["answer"].lower()
    assert r.json()["sources"] == []
    assert api.llm.calls == []


def test_uploads_are_stored_per_user_and_removed_on_delete(api):
    a, b = api.user(), api.user()
    a_id = a.upload("same.csv", "alpha apples")
    b.upload("same.csv", "gamma cherries")

    a_file = api.upload_dir / f"user_{a.id}" / "same.csv"
    b_file = api.upload_dir / f"user_{b.id}" / "same.csv"
    assert a_file.is_file() and b_file.is_file()

    a.delete(f"/sources/{a_id}")
    assert not a_file.exists()
    assert b_file.is_file()


def test_unsupported_file_type_is_rejected(api):
    u = api.user()
    r = u.post("/upload", files={"file": ("evil.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400
    assert u.source_names() == []


# ═════════════════════════════════════════════════════════════════════════════
# Classrooms
# ═════════════════════════════════════════════════════════════════════════════

def test_classrooms_are_private(api):
    a, b = api.user(), api.user()
    room = a.new_room("Maths")
    doc = a.upload("A.csv", DOCS["A.csv"])
    a.import_docs(room, [doc])

    assert b.get("/classrooms").json()["classrooms"] == []
    assert b.get(f"/classrooms/{room}/documents").status_code == 404
    assert b.patch(f"/classrooms/{room}", json={"name": "Hacked"}).status_code == 404
    assert b.import_docs(room, [doc]).status_code == 404
    assert b.delete(f"/classrooms/{room}/documents/{doc}").status_code == 404
    assert b.delete(f"/classrooms/{room}").status_code == 404

    # nothing changed for A
    assert a.room_doc_names(room) == ["A.csv"]
    assert a.get("/classrooms").json()["classrooms"][0]["name"] == "Maths"


def test_classroom_names_are_unique_per_user_only(api):
    a, b = api.user(), api.user()
    a.new_room("Maths")
    b.new_room("Maths")  # same name for another user is fine
    assert a.post("/classrooms", json={"name": "maths"}).status_code == 400


def test_classroom_limit_is_20_per_user(api):
    a, b = api.user(), api.user()
    for i in range(20):
        a.new_room(f"Room {i}")
    assert a.post("/classrooms", json={"name": "One too many"}).status_code == 400
    assert b.post("/classrooms", json={"name": "Fine"}).status_code == 200


def test_cannot_import_another_users_document(api):
    a, b = api.user(), api.user()
    a_doc = a.upload("A.csv", DOCS["A.csv"])
    room = b.new_room("Mine")

    assert b.import_docs(room, [a_doc]).status_code == 400
    assert b.room_doc_names(room) == []


def test_classroom_scope_isolates_retrieval(api):
    u = api.user()
    ids = seed(u)
    r1, r2 = u.new_room("Room 1"), u.new_room("Room 2")
    u.import_docs(r1, [ids["A.csv"], ids["B.csv"]])
    u.import_docs(r2, [ids["C.csv"], ids["D.csv"]])

    # a question about Room 2's document, asked inside Room 1
    r = u.ask("gamma cherries blossom", classroom_ids=[r1])
    assert r.status_code == 200
    assert set(r.json()["sources"]) <= {"A.csv", "B.csv"}
    for word in ("gamma", "delta", "epsilon"):
        assert word not in api.llm.sent_text

    # it still finds its own documents
    r = u.ask("alpha apples orchard", classroom_ids=[r1])
    assert "A.csv" in r.json()["sources"]


def test_document_filter_limits_search(api):
    u = api.user()
    ids = seed(u)
    r = u.ask("anything at all", document_ids=[ids["E.csv"]])
    assert r.json()["sources"] == ["E.csv"]


def test_chat_scope_rejects_other_users_documents(api):
    a, b = api.user(), api.user()
    a_doc = a.upload("A.csv", DOCS["A.csv"])
    b.upload("C.csv", DOCS["C.csv"])

    assert b.ask("alpha", document_ids=[a_doc]).status_code == 400
    assert b.ask("alpha", document_ids=[999999]).status_code == 400
    assert b.ask("alpha", classroom_ids=[999999]).status_code == 400
    assert api.llm.calls == []


def test_shared_document_in_two_classrooms(api):
    u = api.user()
    ids = seed(u)
    r1, r2 = u.new_room("Room 1"), u.new_room("Room 2")
    u.import_docs(r1, [ids["A.csv"]])
    u.import_docs(r2, [ids["A.csv"], ids["C.csv"]])

    assert u.room_doc_names(r1) == ["A.csv"]
    assert u.room_doc_names(r2) == ["A.csv", "C.csv"]

    # importing it again does not create a duplicate
    again = u.import_docs(r1, [ids["A.csv"]]).json()
    assert again["added"] == [] and again["skipped"] == [ids["A.csv"]]
    assert u.room_doc_names(r1) == ["A.csv"]


def test_removing_from_classroom_keeps_the_original(api):
    u = api.user()
    ids = seed(u)
    r1, r2 = u.new_room("Room 1"), u.new_room("Room 2")
    u.import_docs(r1, [ids["A.csv"]])
    u.import_docs(r2, [ids["A.csv"]])

    assert u.delete(f"/classrooms/{r1}/documents/{ids['A.csv']}").status_code == 200
    assert u.room_doc_names(r1) == []
    assert u.room_doc_names(r2) == ["A.csv"]  # still in the other classroom
    assert "A.csv" in u.source_names()        # still in the Knowledge Base
    assert u.get(f"/sources/{ids['A.csv']}/content").status_code == 200  # vectors untouched

    # removing it again is a 404, not a delete of the original
    assert u.delete(f"/classrooms/{r1}/documents/{ids['A.csv']}").status_code == 404

    # deleting it from the Knowledge Base removes it from every classroom
    assert u.delete(f"/sources/{ids['A.csv']}").status_code == 200
    assert u.room_doc_names(r2) == []
    assert "A.csv" not in u.source_names()


def test_empty_classroom_has_no_fallback_to_all_documents(api):
    u = api.user()
    seed(u)
    empty = u.new_room("Empty")

    r = u.ask("alpha apples orchard", classroom_ids=[empty])
    assert r.status_code == 200
    assert "could not find" in r.json()["answer"].lower()
    assert r.json()["sources"] == []
    assert api.llm.calls == []  # the LLM was never called


def test_upload_straight_into_a_classroom(api):
    u = api.user()
    room = u.new_room("Maths")
    r = u.post(
        f"/classrooms/{room}/upload",
        files={"file": ("sheet.csv", b"Name,City\nAsha,Pune\nRavi,Delhi\n", "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["added"] == [r.json()["document_id"]]

    assert u.room_doc_names(room) == ["sheet.csv"]
    assert "sheet.csv" in u.source_names()  # also in the Knowledge Base, stored once


# ═════════════════════════════════════════════════════════════════════════════
# Chats
# ═════════════════════════════════════════════════════════════════════════════

def test_chat_is_saved_and_loaded(api):
    u = api.user()
    u.upload("A.csv", DOCS["A.csv"])
    chat_id = u.post("/chats").json()["id"]

    r = u.ask("alpha apples", chat_id=chat_id)
    assert r.status_code == 200 and r.json()["chat_id"] == chat_id
    u.ask("alpha harvest", chat_id=chat_id)

    chat = u.get(f"/chats/{chat_id}").json()
    assert [m["role"] for m in chat["messages"]] == ["user", "ai", "user", "ai"]
    assert chat["messages"][0]["text"] == "alpha apples"
    assert chat["title"] == "alpha apples"

    listing = u.get("/chats").json()["chats"]
    assert [c["id"] for c in listing] == [chat_id] and listing[0]["message_count"] == 4

    # asking without a chat id does not save anything
    u.ask("alpha apples")
    assert len(u.get(f"/chats/{chat_id}").json()["messages"]) == 4


def test_chats_are_private(api):
    a, b = api.user(), api.user()
    a.upload("A.csv", DOCS["A.csv"])
    b.upload("C.csv", DOCS["C.csv"])
    chat_id = a.post("/chats").json()["id"]
    a.ask("alpha apples", chat_id=chat_id)

    assert b.get("/chats").json()["chats"] == []
    assert b.get(f"/chats/{chat_id}").status_code == 404
    assert b.delete(f"/chats/{chat_id}").status_code == 404

    llm_calls_before = len(api.llm.calls)
    assert b.ask("gamma", chat_id=chat_id).status_code == 404  # cannot write into A's chat
    assert b.get("/ask", params={"question": "gamma", "chat_id": chat_id}).status_code == 404
    assert len(api.llm.calls) == llm_calls_before
    assert len(a.get(f"/chats/{chat_id}").json()["messages"]) == 2


def test_delete_chat(api):
    u = api.user()
    u.upload("A.csv", DOCS["A.csv"])
    chat_id = u.post("/chats").json()["id"]
    u.ask("alpha apples", chat_id=chat_id)

    assert u.delete(f"/chats/{chat_id}").status_code == 200
    assert u.get("/chats").json()["chats"] == []
    assert u.get(f"/chats/{chat_id}").status_code == 404


def test_deleting_a_classroom_keeps_chats_and_documents(api):
    u = api.user()
    doc = u.upload("A.csv", DOCS["A.csv"])
    room = u.new_room("Maths")
    u.import_docs(room, [doc])

    chat_id = u.post("/chats").json()["id"]
    u.ask("alpha apples", classroom_ids=[room], chat_id=chat_id)

    assert u.delete(f"/classrooms/{room}").status_code == 200
    assert u.get("/classrooms").json()["classrooms"] == []
    assert u.source_names() == ["A.csv"]                      # document stays in the KB
    assert len(u.get(f"/chats/{chat_id}").json()["messages"]) == 2  # chat stays


# ═════════════════════════════════════════════════════════════════════════════
# Quizzes
# ═════════════════════════════════════════════════════════════════════════════

def quiz_ready_room(user, name="Maths"):
    """A classroom with one document whose chunk is long enough for the quiz sampler."""
    doc = user.upload("quiz.csv", DOCS["A.csv"], rows=6, repeat=3)
    room = user.new_room(name)
    user.import_docs(room, [doc])
    return room


QUIZ_BODY = {
    "document_ids": [],
    "num_questions": 5,
    "difficulty": "medium",
    "include_true_false": False,
}


def attempt_body(room, questions, answers):
    return {
        "classroom_id": room,
        "document_ids": [],
        "difficulty": "medium",
        "include_true_false": False,
        "questions": questions,
        "answers": answers,
    }


def test_quiz_generate_save_and_review(api):
    u = api.user()
    room = quiz_ready_room(u)

    r = u.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY)
    assert r.status_code == 200, r.text
    questions = r.json()["questions"]
    assert len(questions) >= 3

    n = len(questions)
    answers = [q["answer_index"] for q in questions]
    answers[0] = (answers[0] + 1) % 4  # one wrong answer

    saved = u.post("/quiz/attempts", json=attempt_body(room, questions, answers))
    assert saved.status_code == 200, saved.text
    assert saved.json()["correct"] == n - 1
    assert saved.json()["score"] == round(100 * (n - 1) / n)

    attempts = u.get("/quiz/attempts").json()["attempts"]
    assert [a["id"] for a in attempts] == [saved.json()["id"]]

    full = u.get(f"/quiz/attempts/{saved.json()['id']}").json()
    assert len(full["questions"]) == n
    assert full["answers"] == answers
    assert full["settings"]["difficulty"] == "medium"


def test_quiz_needs_documents(api):
    u = api.user()
    room = u.new_room("Empty")
    r = u.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY)
    assert r.status_code == 400


def test_quizzes_are_private(api):
    a, b = api.user(), api.user()
    room = quiz_ready_room(a)
    questions = a.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY).json()["questions"]
    answers = [q["answer_index"] for q in questions]
    saved = a.post("/quiz/attempts", json=attempt_body(room, questions, answers)).json()

    # B cannot generate a quiz from A's classroom, save into it, list or read A's attempts
    assert b.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY).status_code == 404
    assert b.post("/quiz/attempts", json=attempt_body(room, questions, answers)).status_code == 404
    assert b.get("/quiz/attempts").json()["attempts"] == []
    assert b.get(f"/quiz/attempts/{saved['id']}").status_code == 404

    assert len(a.get("/quiz/attempts").json()["attempts"]) == 1


def test_attempt_survives_classroom_deletion(api):
    u = api.user()
    room = quiz_ready_room(u, "Maths")
    questions = u.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY).json()["questions"]
    answers = [q["answer_index"] for q in questions]
    saved = u.post("/quiz/attempts", json=attempt_body(room, questions, answers)).json()

    assert u.delete(f"/classrooms/{room}").status_code == 200

    r = u.get(f"/quiz/attempts/{saved['id']}")
    assert r.status_code == 200
    assert r.json()["classroom_id"] is None          # link is cleared...
    assert r.json()["classroom_name"] == "Maths"     # ...but the name is kept
    assert len(r.json()["questions"]) == len(questions)


def test_attempt_answers_must_match_questions(api):
    u = api.user()
    room = quiz_ready_room(u)
    questions = u.post(f"/classrooms/{room}/quiz", json=QUIZ_BODY).json()["questions"]
    r = u.post("/quiz/attempts", json=attempt_body(room, questions, [0]))
    assert r.status_code == 400