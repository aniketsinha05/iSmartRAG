import os
import json
import threading

import faiss
import numpy as np
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

BASE = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE, "faiss_db")
os.makedirs(DB_DIR, exist_ok=True)

INDEX_PATH = os.path.join(DB_DIR, "index.faiss")
META_PATH = os.path.join(DB_DIR, "records.json")
VEC_PATH = os.path.join(DB_DIR, "vectors.npy")
DIM = 384

_embedder = DefaultEmbeddingFunction()
_lock = threading.Lock()


def _empty():
    return np.zeros((0, DIM), dtype="float32")


def _embed(texts):
    vecs = np.array(_embedder(texts), dtype="float32")
    faiss.normalize_L2(vecs)
    return vecs


def _load():
    if os.path.exists(META_PATH) and os.path.exists(VEC_PATH):
        with open(META_PATH, encoding="utf-8") as f:
            records = json.load(f)
        return records, np.load(VEC_PATH)
    return [], _empty()


def _build_index(vecs):
    index = faiss.IndexFlatIP(DIM)
    if len(vecs):
        index.add(vecs)
    return index


def chunk_text(text, size=800, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start:start + size].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap
    return chunks


def add_document(text, source, doc_type):
    chunks = chunk_text(text)
    if not chunks:
        return 0

    new_vecs = _embed(chunks)

    with _lock:
        records, vecs = _load()

        # remove old chunks of the same source (re-upload = replace)
        keep = [i for i, r in enumerate(records) if r["source"] != source]
        records = [records[i] for i in keep]
        vecs = vecs[keep] if keep else _empty()

        for i, chunk in enumerate(chunks):
            records.append({
                "id": f"{source}_{i}",
                "text": chunk,
                "source": source,
                "type": doc_type,
            })
        vecs = np.vstack([vecs, new_vecs])

        index = _build_index(vecs)
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f)
        np.save(VEC_PATH, vecs)
        faiss.write_index(index, INDEX_PATH)

    return len(chunks)


def search(query, n_results=3):
    with _lock:
        records, vecs = _load()

    if not records:
        return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

    index = _build_index(vecs)
    k = min(n_results, len(records))
    scores, ids = index.search(_embed([query]), k)

    found = [(s, i) for s, i in zip(scores[0], ids[0]) if i != -1]
    return {
        "ids": [[records[i]["id"] for _, i in found]],
        "documents": [[records[i]["text"] for _, i in found]],
        "metadatas": [[{"source": records[i]["source"], "type": records[i]["type"]} for _, i in found]],
        "distances": [[float(1 - s) for s, _ in found]],
    }


if __name__ == "__main__":
    n = add_document("FAISS is a library for fast similarity search of vectors.", "test.txt", "test")
    print("Stored chunks:", n)
    print(search("what is FAISS?", 1)["documents"][0])