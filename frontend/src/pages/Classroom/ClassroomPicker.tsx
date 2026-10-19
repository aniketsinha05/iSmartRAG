import { useCallback, useEffect, useState } from "react";
import type { Classroom, Source } from "../../types";
import {
  fetchClassrooms,
  fetchClassroomDocuments,
  importDocuments,
  removeClassroomDocument,
  uploadToClassroom,
  createClassroom,
  renameClassroom,
  deleteClassroom,
} from "../../services/classroomService";
import { ApiError } from "../../services/apiClient";

import Icon from "../../components/common/Icon";
import FileBadge from "../../components/common/FileBadge";

const MAX_CLASSROOMS = 20;

function typeLabel(source: Source): string {
  if (source.type === "WEB") return "Website";
  if (source.type === "EXCEL")
    return source.name.toLowerCase().endsWith(".csv") ? "CSV" : "Excel";
  return source.type;
}

// Show the server's message (e.g. "A classroom with this name already exists.")
function errText(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.detail) return e.detail;
  return fallback;
}

type ClassroomCardProps = {
  room: Classroom;
  allSources: Source[];
  onChatOpen: (id: number) => void;
  onRename: (room: Classroom) => void;
  onDelete: (room: Classroom) => void;
  onChanged: () => void;
  refreshSources: () => Promise<void>;
};

function ClassroomCard({
  room, allSources, onChatOpen, onRename, onDelete, onChanged, refreshSources,
}: ClassroomCardProps) {
  const [docs, setDocs] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<number | "">("");
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchClassroomDocuments(room.id);
      setDocs(data.documents);
    } catch {
      setMessage("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  const available = allSources.filter(
    (s) => !docs.some((d) => d.id === s.id),
  );

  const addFromKB = async () => {
    if (selected === "" || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await importDocuments(room.id, [selected]);
      setSelected("");
      await load();
      onChanged();
      setMessage(`Added to ${room.name}.`);
    } catch (e) {
      setMessage(errText(e, "Could not add document."));
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeClassroomDocument(room.id, id);
      await load();
      onChanged();
    } catch (e) {
      setMessage(errText(e, "Could not remove document."));
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setMessage(`Uploading ${file.name}...`);
    try {
      await uploadToClassroom(room.id, file);
      await load();
      await refreshSources();
      onChanged();
      setMessage(`${file.name} added.`);
    } catch (e) {
      setMessage(errText(e, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sx-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="cr-card-icon"><Icon name="classroom" size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong className="cp-name">{room.name}</strong>
          <small className="cp-count">
            {docs.length} document{docs.length === 1 ? "" : "s"}
          </small>
        </div>
        <button className="hm-small" onClick={() => onRename(room)}>Rename</button>
        <button className="hm-small" onClick={() => onDelete(room)}>Delete</button>
        <button
          type="button"
          className="hm-primary hm-small"
          onClick={() => onChatOpen(room.id)}
        >
          Chat
        </button>
      </div>

      <div
        className={`hm-drop ${dragging ? "drag" : ""}`}
        style={{ padding: 14, minHeight: 70 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleDrop(file);
        }}
      >
        <Icon name="upload" size={22} />
        <span style={{ fontSize: 13 }}>Drop a file here to add it to {room.name}</span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <select
          className="sx-select"
          style={{ flex: 1 }}
          value={selected}
          onChange={(e) => setSelected(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={busy || !available.length}
        >
          <option value="">
            {available.length ? "Select from Knowledge Base..." : "No new sources in Knowledge Base"}
          </option>
          {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="hm-primary" disabled={selected === "" || busy} onClick={addFromKB}>
          + Add
        </button>
      </div>

      {message && <p className="cp-msg">{message}</p>}

      {loading ? (
        <div className="hm-empty">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="hm-empty">No documents yet. Add from the Knowledge Base or drop a file above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((doc) => (
            <div key={doc.id} className="cp-doc">
              <FileBadge type={doc.type} />
              <span className="cp-doc-name">{doc.name}</span>
              <span className="kb-type">{typeLabel(doc)}</span>
              <button
                type="button"
                className="hm-x"
                aria-label={`Remove ${doc.name} from classroom`}
                disabled={busy}
                onClick={() => removeDoc(doc.id)}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassroomPicker({
  sources, refreshSources,
}: {
  sources: Source[];
  refreshSources: () => Promise<void>;
}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setClassrooms(await fetchClassrooms());
      setError("");
    } catch {
      setError("Could not load classrooms. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSources();
    void load();
  }, [load, refreshSources]);

  const create = async () => {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await createClassroom(value);
      setName("");
      await load();
    } catch (e) {
      setError(errText(e, "Could not create classroom."));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (room: Classroom) => {
    const value = window.prompt("Enter the new classroom name:", room.name);
    if (value === null || !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      await renameClassroom(room.id, value.trim());
      await load();
    } catch (e) {
      setError(errText(e, "Could not rename classroom."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (room: Classroom) => {
    if (!window.confirm(`Delete "${room.name}"? Its saved chats will be removed, but Knowledge Base documents will remain.`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteClassroom(room.id);
      await load();
    } catch (e) {
      setError(errText(e, "Could not delete classroom."));
    } finally {
      setBusy(false);
    }
  };

  const openChat = (id: number) => {
    try {
      sessionStorage.setItem("mybookai-fresh-chat", "1");
      localStorage.setItem("mybookai-chat-scope", String(id));
    } catch {}
    window.location.hash = "/chat";
  };

  return (
    <div className="page-content kb-page">
      <div className="kb-head">
        <div className="kb-title">
          <div className="sx-header-icon"><Icon name="classroom" size={24} /></div>
          <div>
            <h1>Classrooms</h1>
            <p>Manage documents and open chats for each classroom.</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          className="sx-select"
          style={{ flex: 1 }}
          placeholder="New classroom name (1–40 characters)"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
          disabled={busy || classrooms.length >= MAX_CLASSROOMS}
        />
        <button
          className="hm-primary"
          onClick={create}
          disabled={busy || !name.trim() || classrooms.length >= MAX_CLASSROOMS}
        >
          + Create Classroom
        </button>
      </div>

      <p className="cp-count">{classrooms.length} / {MAX_CLASSROOMS} classrooms</p>
      {loading && <div className="hm-empty">Loading classrooms...</div>}
      {error && <p className="hm-error">{error}</p>}

      {!loading && classrooms.length === 0 && !error && (
        <div className="hm-empty">No classrooms yet. Create your first one above.</div>
      )}

      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 18,
        }}>
          {classrooms.map((room) => (
            <ClassroomCard
              key={room.id}
              room={room}
              allSources={sources}
              onChatOpen={openChat}
              onRename={rename}
              onDelete={remove}
              onChanged={() => void load()}
              refreshSources={refreshSources}
            />
          ))}
        </div>
      )}
    </div>
  );
}