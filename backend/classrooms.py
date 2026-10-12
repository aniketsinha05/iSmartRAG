"""
classrooms.py
5 fixed classrooms. A classroom only stores the NAMES of the documents (the `source`
values in the vector store) it can use. No file, chunk or vector is ever copied.
"""

import json
import os
import threading

BASE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE, "classrooms.json")
COUNT = 5

_lock = threading.Lock()


def _default():
    return {str(i): {"name": f"Classroom {i}", "sources": []} for i in range(1, COUNT + 1)}


def _load():
    data = _default()
    if os.path.exists(PATH):
        with open(PATH, encoding="utf-8") as f:
            saved = json.load(f)
        for key in data:
            if key in saved:
                data[key].update(saved[key])
    return data


def _save(data):
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def is_valid(classroom_id):
    return isinstance(classroom_id, int) and 1 <= classroom_id <= COUNT


def get_classroom(classroom_id):
    with _lock:
        item = _load()[str(classroom_id)]
    return {"id": classroom_id, "name": item["name"], "document_count": len(item["sources"])}


def list_classrooms():
    with _lock:
        data = _load()
    return [
        {"id": int(key), "name": item["name"], "document_count": len(item["sources"])}
        for key, item in data.items()
    ]


def get_sources(classroom_id):
    with _lock:
        return list(_load()[str(classroom_id)]["sources"])


def add_sources(classroom_id, names):
    """Returns (added, skipped). Names already in the classroom are skipped (no duplicates)."""
    added, skipped = [], []
    with _lock:
        data = _load()
        sources = data[str(classroom_id)]["sources"]
        for name in names:
            if name in sources:
                skipped.append(name)
            else:
                sources.append(name)
                added.append(name)
        if added:
            _save(data)
    return added, skipped


def remove_source(classroom_id, name):
    with _lock:
        data = _load()
        sources = data[str(classroom_id)]["sources"]
        if name not in sources:
            return False
        sources.remove(name)
        _save(data)
    return True


def remove_source_everywhere(name):
    """Used when a document is permanently deleted from the main Knowledge Base."""
    count = 0
    with _lock:
        data = _load()
        for item in data.values():
            if name in item["sources"]:
                item["sources"].remove(name)
                count += 1
        if count:
            _save(data)
    return count