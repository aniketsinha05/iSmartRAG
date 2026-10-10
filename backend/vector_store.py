import os
import json
import threading

import faiss
import numpy as np
import torch
from datetime import datetime, timezone
from langchain_text_splitters import RecursiveCharacterTextSplitter
from transformers import AutoModel, AutoTokenizer

BASE = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE, "faiss_db")
os.makedirs(DB_DIR, exist_ok=True)

INDEX_PATH = os.path.join(DB_DIR, "index.faiss")
META_PATH = os.path.join(DB_DIR, "records.json")
VEC_PATH = os.path.join(DB_DIR, "vectors.npy")
DIM = 384
MODEL_NAME = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
_model = AutoModel.from_pretrained(MODEL_NAME).eval()
_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
_lock = threading.Lock()


def _empty():
    return np.zeros((0, DIM), dtype="float32")


def _embed(texts, is_query=False):
    if is_query:
        texts = [QUERY_PREFIX + t for t in texts]

    out = []
    with torch.no_grad():
        for i in range(0, len(texts), 32):
            batch = _tokenizer(
                texts[i:i + 32], padding=True, truncation=True,
                max_length=512, return_tensors="pt",
            )
            cls = _model(**batch).last_hidden_state[:, 0]  # bge uses the [CLS] vector
            out.append(torch.nn.functional.normalize(cls, dim=1))

    return torch.cat(out).numpy().astype("float32")


def _load():
    if os.path.exists(META_PATH) and os.path.exists(VEC_PATH):
        with open(META_PATH, encoding="utf-8") as f:
            records = json.load(f)
        if records and records[0].get("model") != MODEL_NAME:
            raise RuntimeError(
                "The saved index was made with a different embedding model. "
                "Delete the backend/faiss_db folder and upload your files again."
            )
        return records, np.load(VEC_PATH)
    return [], _empty()


def _build_index(vecs):
    index = faiss.IndexFlatIP(DIM)
    if len(vecs):
        index.add(vecs)
    return index


def chunk_text(text):
    return [c.strip() for c in _splitter.split_text(text) if c.strip()]


def add_document(text, source, doc_type):
    return add_pieces([{"text": text}], source, doc_type)


def add_pieces(pieces, source, doc_type):
    """pieces: [{"text", "page"?, "sheet"?, "rows"?, "section"?, "split"?}]"""
    chunks = []  # (chunk text, piece)
    for p in pieces:
        parts = chunk_text(p["text"]) if p.get("split", True) else [p["text"].strip()]
        chunks += [(part, p) for part in parts if part]

    if not chunks:
        return 0

    # the section heading is added to the text that is embedded (not to the stored text)
    new_vecs = _embed([(p["section"] + "\n" if p.get("section") else "") + t for t, p in chunks])
    now = datetime.now(timezone.utc).isoformat()

    with _lock:
        records, vecs = _load()

        # remove old chunks of the same source (re-upload = replace)
        keep = [i for i, r in enumerate(records) if r["source"] != source]
        records = [records[i] for i in keep]
        vecs = vecs[keep] if keep else _empty()

        for i, (chunk, p) in enumerate(chunks):
            rec = {
                "id": f"{source}_{i}",
                "text": chunk,
                "source": source,
                "type": doc_type,
                "added_at": now,
                "model": MODEL_NAME,
            }
            for key in ("page", "sheet", "rows", "section"):
                if p.get(key) is not None:
                    rec[key] = p[key]
            if doc_type == "website":
                rec["url"] = source
            records.append(rec)
        vecs = np.vstack([vecs, new_vecs])

        _save(records, vecs)

    return len(chunks)


def _meta(r):
    return {k: v for k, v in r.items() if k not in ("id", "text", "model")}


def search(query, n_results=3):
    with _lock:
        records, vecs = _load()

    if not records:
        return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

    index = _build_index(vecs)
    k = min(n_results, len(records))
    scores, ids = index.search(_embed([query], is_query=True), k)

    found = [(s, i) for s, i in zip(scores[0], ids[0]) if i != -1]
    return {
        "ids": [[records[i]["id"] for _, i in found]],
        "documents": [[records[i]["text"] for _, i in found]],
        "metadatas": [[_meta(records[i]) for _, i in found]],
        "distances": [[float(1 - s) for s, _ in found]],
    }


def _save(records, vecs):
    index = _build_index(vecs)

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f)

    np.save(VEC_PATH, vecs)
    faiss.write_index(index, INDEX_PATH)


def list_sources():
    with _lock:
        records, _ = _load()

    grouped = {}

    for r in records:
        item = grouped.setdefault(
            r["source"],
            {
                "name": r["source"],
                "type": r["type"],
                "chunks": 0,
                "added_at": r.get("added_at"),
            },
        )
        item["chunks"] += 1

    return list(grouped.values())


def get_source_chunks(source, limit=20):
    with _lock:
        records, _ = _load()

    return [r["text"] for r in records if r["source"] == source][:limit]


def delete_source(source):
    with _lock:
        records, vecs = _load()

        keep = [i for i, r in enumerate(records) if r["source"] != source]
        removed = len(records) - len(keep)

        if removed == 0:
            return 0

        records = [records[i] for i in keep]
        vecs = vecs[keep] if keep else _empty()
        _save(records, vecs)

    return removed

if __name__ == "__main__":
    n = add_document("FAISS is a library for fast similarity search of vectors.", "test.txt", "test")
    print("Stored chunks:", n)
    print(search("what is FAISS?", 1)["documents"][0])