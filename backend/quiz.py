import json
import random
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel


class QuizRequest(BaseModel):
    document_names: list[str] = []
    num_questions: Literal[5, 10] = 5
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    include_true_false: bool = False







DIFFICULTY_HINT = {
    "easy": "direct recall of facts stated in the text",
    "medium": "understanding: explain, compare or apply a concept from the text",
    "hard": "multi-step reasoning or combining two ideas, with plausible wrong options",
}

def sample_chunks(chunks_by_doc, limit):
    """chunks_by_doc: {file_name: [{"text":..., "page":..., "section":...}]}.
    Adapt the keys to what your records contain."""
    pools = []
    for file, chunks in chunks_by_doc.items():
        good = [c for c in chunks if len(c["text"]) >= 200]
        random.shuffle(good)
        pools.append((file, good))
    picked = []
    while len(picked) < limit and any(pool for _, pool in pools):
        for file, pool in pools:
            if pool and len(picked) < limit:
                c = pool.pop()
                picked.append({"text": c["text"], "source": {
                    "file": file, "page": c.get("page"), "section": c.get("section")}})
    return [{"id": f"C{i + 1}", **c} for i, c in enumerate(picked)]

def build_prompt(chunks, n, difficulty, include_tf):
    excerpts = "\n\n".join(f"[{c['id']}] {c['text']}" for c in chunks)
    kinds = ('Mostly multiple choice (exactly 4 options) plus about 30% true/false '
             '(options exactly ["True","False"]).' if include_tf
             else "All multiple choice with exactly 4 options.")
    return f"""Write exactly {n} quiz questions using ONLY the excerpts below.
Difficulty: {difficulty} - {DIFFICULTY_HINT[difficulty]}.
{kinds}
Each question must be answerable from one excerpt. No duplicate questions.
Return JSON only: {{"questions":[{{"type":"mcq or tf","question":"...","options":["..."],"answer_index":0,"explanation":"1-2 sentences from the text","chunk":"C1"}}]}}

EXCERPTS:
{excerpts}"""

def shuffle_options(options, answer_index):
    order = list(range(len(options)))
    random.shuffle(order)
    return [options[i] for i in order], order.index(answer_index)

def validate(data, n, chunks):
    by_id = {c["id"]: c for c in chunks}
    out, seen = [], set()
    for q in data.get("questions", []):
        try:
            qtype, text = q["type"], str(q["question"]).strip()
            options = [str(o).strip() for o in q["options"]]
            idx, chunk = int(q["answer_index"]), by_id[q["chunk"]]
        except (KeyError, TypeError, ValueError):
            continue
        if qtype == "tf":
            options = ["True", "False"]
        elif qtype != "mcq" or len(options) != 4:
            continue
        if not text or text.lower() in seen or not 0 <= idx < len(options):
            continue
        if qtype == "mcq":
            options, idx = shuffle_options(options, idx)
        seen.add(text.lower())
        out.append({"id": str(uuid4()), "type": qtype, "question": text,
                    "options": options, "answer_index": idx,
                    "explanation": str(q.get("explanation", "")).strip(),
                    "source": chunk["source"]})
    return out[:n]




def generate_questions(call_llm, chunks, body):
    """call_llm(prompt) -> JSON string. Tries up to 2 times, keeps the best result."""
    prompt = build_prompt(chunks, body.num_questions, body.difficulty, body.include_true_false)
    best = []
    for _ in range(2):
        try:
            data = json.loads(call_llm(prompt))
        except (json.JSONDecodeError, TypeError):
            continue
        questions = validate(data, body.num_questions, chunks)
        if len(questions) > len(best):
            best = questions
        if len(best) >= round(body.num_questions * 0.6):
            break
    return best




class QuizAttemptRequest(BaseModel):
    classroom_id: int
    document_names: list[str] = []
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    include_true_false: bool = False
    questions: list[dict]
    answers: list[int | None]