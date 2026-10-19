import os
import threading

import faiss
import numpy as np
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.models import KnowledgeBase, VectorChunk

BASE = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE, "faiss_db")
os.makedirs(DB_DIR, exist_ok=True)

DIM = 384
MODEL_NAME = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_models = {}  # the bge model is loaded the first time it is needed
_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
_lock = threading.Lock()


# ---------- embedding (unchanged) ----------

def _empty():
    return np.zeros((0, DIM), dtype="float32")


def _get_model():
    if not _models:
        from transformers import AutoModel, AutoTokenizer

        _models["tokenizer"] = AutoTokenizer.from_pretrained(MODEL_NAME)
        _models["model"] = AutoModel.from_pretrained(MODEL_NAME).eval()
    return _models["tokenizer"], _models["model"]


def _embed(texts, is_query=False):
    import torch

    tokenizer, model = _get_model()

    if is_query:
        texts = [QUERY_PREFIX + t for t in texts]

    out = []
    with torch.no_grad():
        for i in range(0, len(texts), 32):
            batch = tokenizer(
                texts[i:i + 32], padding=True, truncation=True,
                max_length=512, return_tensors="pt",
            )
            cls = model(**batch).last_hidden_state[:, 0]  # bge uses the [CLS] vector
            out.append(torch.nn.functional.normalize(cls, dim=1))

    return torch.cat(out).numpy().astype("float32")


# ---------- per-user vector files ----------

def _vec_path(user_id):
    folder = os.path.join(DB_DIR, f"user_{int(user_id)}")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, "vectors.npz")


def _load_vecs(user_id):
    path = _vec_path(user_id)
    if not os.path.exists(path):
        return _empty(), []
    with np.load(path) as data:
        return data["vecs"], [str(i) for i in data["ids"]]


def _save_vecs(user_id, vecs, ids):
    path = _vec_path(user_id)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        np.savez(f, vecs=vecs, ids=np.array(ids, dtype="U64"))
    os.replace(tmp, path)


def _doc_id_of(chunk_id):
    return int(chunk_id.split("_", 1)[0])


def _build_index(vecs):
    index = faiss.IndexFlatIP(DIM)
    if len(vecs):
        index.add(vecs)
    return index


def chunk_text(text):
    return [c.strip() for c in _splitter.split_text(text) if c.strip()]


# ---------- public functions ----------

def add_document(db: Session, user_id, text, source, doc_type, size_bytes=None):
    return add_pieces(db, user_id, [{"text": text}], source, doc_type, size_bytes)


def add_pieces(db: Session, user_id, pieces, source, doc_type, size_bytes=None):
    """pieces: [{"text", "page"?, "sheet"?, "rows"?, "section"?, "split"?}]
    Returns (document_id, chunk_count). (None, 0) if there was no text.
    Uploading the same filename again replaces that document (same id)."""
    chunks = []  # (chunk text, piece)
    for p in pieces:
        parts = chunk_text(p["text"]) if p.get("split", True) else [p["text"].strip()]
        chunks += [(part, p) for part in parts if part]

    if not chunks:
        return None, 0

    # the section heading is added to the text that is embedded (not to the stored text)
    new_vecs = _embed(
        [(p["section"] + "\n" if p.get("section") else "") + t for t, p in chunks]
    )

    with _lock:
        doc = db.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.user_id == user_id, KnowledgeBase.name == source
            )
        )
        if doc is None:
            doc = KnowledgeBase(user_id=user_id, name=source, type=doc_type)
            db.add(doc)
            db.flush()
        else:
            db.execute(delete(VectorChunk).where(VectorChunk.document_id == doc.id))

        doc_id = doc.id
        doc.type = doc_type
        doc.chunks = len(chunks)
        if size_bytes is not None:
            doc.size_bytes = size_bytes

        new_ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        for cid, (text, p) in zip(new_ids, chunks):
            db.add(VectorChunk(
                id=cid,
                document_id=doc_id,
                text=text,
                page=p.get("page"),
                sheet=p.get("sheet"),
                rows=str(p["rows"]) if p.get("rows") is not None else None,
                section=p.get("section"),
                model=MODEL_NAME,
            ))

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        vecs, ids = _load_vecs(user_id)
        keep = [i for i, cid in enumerate(ids) if _doc_id_of(cid) != doc_id]
        vecs = vecs[keep] if keep else _empty()
        ids = [ids[i] for i in keep]
        _save_vecs(user_id, np.vstack([vecs, new_vecs]), ids + new_ids)

    return doc_id, len(chunks)


def search(db: Session, user_id, query, n_results=3, document_ids=None):
    """Only ever searches this user's vectors.
    document_ids=None searches all of the user's documents. A list limits the search
    to those documents (an empty list returns nothing) - this is how classrooms stay isolated."""
    empty = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

    with _lock:
        vecs, ids = _load_vecs(user_id)

    if document_ids is not None:
        allowed = {int(i) for i in document_ids}
        keep = [i for i, cid in enumerate(ids) if _doc_id_of(cid) in allowed]
        vecs = vecs[keep] if keep else _empty()
        ids = [ids[i] for i in keep]

    if not ids:
        return empty

    index = _build_index(vecs)
    k = min(n_results, len(ids))
    scores, idx = index.search(_embed([query], is_query=True), k)
    found = [(float(s), ids[i]) for s, i in zip(scores[0], idx[0]) if i != -1]
    if not found:
        return empty

    rows = db.execute(
        select(VectorChunk, KnowledgeBase)
        .join(KnowledgeBase, KnowledgeBase.id == VectorChunk.document_id)
        .where(
            VectorChunk.id.in_([cid for _, cid in found]),
            KnowledgeBase.user_id == user_id,  # second safety check
        )
    ).all()
    by_id = {c.id: (c, d) for c, d in rows}

    out_ids, out_docs, out_meta, out_dist = [], [], [], []
    for score, cid in found:
        if cid not in by_id:
            continue
        chunk, doc = by_id[cid]
        meta = {
            "source": doc.name,
            "document_id": doc.id,
            "type": doc.type,
            "added_at": doc.added_at.isoformat() if doc.added_at else None,
        }
        for key in ("page", "sheet", "rows", "section"):
            if getattr(chunk, key) is not None:
                meta[key] = getattr(chunk, key)
        if doc.type == "website":
            meta["url"] = doc.name
        out_ids.append(cid)
        out_docs.append(chunk.text)
        out_meta.append(meta)
        out_dist.append(1 - score)

    return {
        "ids": [out_ids],
        "documents": [out_docs],
        "metadatas": [out_meta],
        "distances": [out_dist],
    }


def list_sources(db: Session, user_id):
    docs = db.scalars(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == user_id)
        .order_by(KnowledgeBase.id)
    ).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "type": d.type,
            "chunks": d.chunks or 0,
            "added_at": d.added_at.isoformat() if d.added_at else None,
            "size_bytes": d.size_bytes,
        }
        for d in docs
    ]


def get_source_chunks(db: Session, user_id, document_id, limit=20):
    rows = db.execute(
        select(VectorChunk.id, VectorChunk.text)
        .join(KnowledgeBase, KnowledgeBase.id == VectorChunk.document_id)
        .where(KnowledgeBase.id == document_id, KnowledgeBase.user_id == user_id)
    ).all()
    rows.sort(key=lambda r: int(r[0].split("_", 1)[1]))  # original chunk order
    return [text for _, text in rows][:limit]


def delete_source(db: Session, user_id, document_id):
    """Returns the number of chunks removed, or None if the document is not this user's.
    The database also removes the chunk rows and classroom links (ON DELETE CASCADE)."""
    with _lock:
        doc = db.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.id == document_id, KnowledgeBase.user_id == user_id
            )
        )
        if doc is None:
            return None
        removed = doc.chunks or 0
        db.delete(doc)
        db.commit()

        vecs, ids = _load_vecs(user_id)
        keep = [i for i, cid in enumerate(ids) if _doc_id_of(cid) != document_id]
        if len(keep) != len(ids):
            _save_vecs(
                user_id,
                vecs[keep] if keep else _empty(),
                [ids[i] for i in keep],
            )
    return removed