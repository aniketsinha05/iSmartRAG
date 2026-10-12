import json
import os
import threading

BASE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE, "classrooms.json")
MAX_CLASSROOMS = 20
_lock = threading.Lock()


def _default():
    return {
        **{str(i): {"name": f"Classroom {i}", "sources": []} for i in range(1, 6)},
        "_next_id": 6,
    }


def _load():
    if not os.path.exists(PATH):
        return _default()

    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)

    ids = [int(k) for k in data if k.isdigit()]
    data.setdefault("_next_id", max(ids, default=0) + 1)
    return data


def _save(data):
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _valid_name(name):
    return isinstance(name, str) and 1 <= len(name.strip()) <= 40


def _unique_name(data, name, exclude=None):
    return not any(
        k.isdigit() and int(k) != exclude
        and item["name"].strip().casefold() == name.strip().casefold()
        for k, item in data.items()
    )


def is_valid(classroom_id):
    if not isinstance(classroom_id, int):
        return False
    with _lock:
        return str(classroom_id) in _load()


def get_classroom(classroom_id):
    with _lock:
        item = _load().get(str(classroom_id))
        return (
            {"id": classroom_id, "name": item["name"],
             "document_count": len(item["sources"])}
            if item else None
        )


def list_classrooms():
    with _lock:
        data = _load()
    return [
        {"id": int(k), "name": v["name"], "document_count": len(v["sources"])}
        for k, v in data.items() if k.isdigit()
    ]


def create_classroom(name):
    if not _valid_name(name):
        return None, "Name must be 1–40 characters."

    name = name.strip()
    with _lock:
        data = _load()
        if sum(k.isdigit() for k in data) >= MAX_CLASSROOMS:
            return None, "Maximum of 20 classrooms reached."
        if not _unique_name(data, name):
            return None, "A classroom with this name already exists."

        classroom_id = data["_next_id"]
        data[str(classroom_id)] = {"name": name, "sources": []}
        data["_next_id"] = classroom_id + 1
        _save(data)

    return classroom_id, None


def rename_classroom(classroom_id, name):
    if not _valid_name(name):
        return False, "Name must be 1–40 characters."

    name = name.strip()
    with _lock:
        data = _load()
        key = str(classroom_id)
        if key not in data:
            return False, "Classroom not found."
        if not _unique_name(data, name, classroom_id):
            return False, "A classroom with this name already exists."

        data[key]["name"] = name
        _save(data)

    return True, None


def delete_classroom(classroom_id):
    with _lock:
        data = _load()
        if str(classroom_id) not in data:
            return False

        del data[str(classroom_id)]
        _save(data)
    return True


def get_sources(classroom_id):
    with _lock:
        item = _load().get(str(classroom_id))
        return list(item["sources"]) if item else []


def add_sources(classroom_id, names):
    added, skipped = [], []
    with _lock:
        data = _load()
        item = data.get(str(classroom_id))
        if not item:
            return added, list(names)

        for name in names:
            if name in item["sources"]:
                skipped.append(name)
            else:
                item["sources"].append(name)
                added.append(name)

        if added:
            _save(data)

    return added, skipped


def remove_source(classroom_id, name):
    with _lock:
        data = _load()
        item = data.get(str(classroom_id))
        if not item or name not in item["sources"]:
            return False
        item["sources"].remove(name)
        _save(data)
    return True


def remove_source_everywhere(name):
    count = 0
    with _lock:
        data = _load()
        for key, item in data.items():
            if key.isdigit() and name in item["sources"]:
                item["sources"].remove(name)
                count += 1
        if count:
            _save(data)
    return count