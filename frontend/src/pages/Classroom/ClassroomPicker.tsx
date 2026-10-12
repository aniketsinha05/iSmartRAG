import { useCallback, useEffect, useState } from "react";
import type { Classroom, Source } from "../../types";
import {
  fetchClassrooms,
  fetchClassroomDocuments,
  importDocuments,
  removeClassroomDocument,
  uploadToClassroom,
} from "../../services/classroomService";

const TYPE_ICON: Record<Source["type"], string> = {
  PDF: "📕", DOCX: "📘", PPT: "📙", EXCEL: "📗", WEB: "🌐",
};

function typeLabel(source: Source): string {
  if (source.type === "WEB") return "Website";
  if (source.type === "EXCEL")
    return source.name.toLowerCase().endsWith(".csv") ? "CSV" : "Excel";
  return source.type;
}

type ClassroomCardProps = {
  room: Classroom;
  allSources: Source[];
  onChatOpen: (id: number) => void;
};

function ClassroomCard({ room, allSources, onChatOpen }: ClassroomCardProps) {
  const [docs, setDocs] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
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

  const inClassroom = new Set(docs.map((d) => d.name));
  const available = allSources.filter((s) => !inClassroom.has(s.name));

  const addFromKB = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await importDocuments(room.id, [selected]);
      setSelected("");
      await load();
      setMessage(`Added to ${room.name}.`);
    } catch {
      setMessage("Could not add document.");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (name: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeClassroomDocument(room.id, name);
      await load();
    } catch {
      setMessage("Could not remove document.");
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
      setMessage(`${file.name} added.`);
    } catch {
      setMessage("Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sx-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="cr-card-icon">🏫</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
            {room.name}
          </strong>
          <small style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {docs.length} document{docs.length === 1 ? "" : "s"}
          </small>
        </div>
        <button
          type="button"
          className="hm-primary hm-small"
          onClick={() => onChatOpen(room.id)}
        >
          💬 Chat
        </button>
      </div>

      {/* Drag & drop zone */}
      <div
        className={`hm-drop ${dragging ? "drag" : ""}`}
        style={{ padding: "14px", minHeight: 70 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleDrop(file);
        }}
      >
        <span style={{ fontSize: 20 }}>📂</span>
        <span style={{ fontSize: 13 }}>Drop a file here to add it to {room.name}</span>
      </div>

      {/* KB dropdown */}
      <div style={{ display: "flex", gap: 8 }}>
        <select
          className="sx-select"
          style={{ flex: 1 }}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={busy || available.length === 0}
        >
          <option value="">
            {available.length === 0
              ? "No new sources in Knowledge Base"
              : "Select from Knowledge Base..."}
          </option>
          {available.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="hm-primary"
          disabled={!selected || busy}
          onClick={addFromKB}
          style={{ whiteSpace: "nowrap" }}
        >
          + Add
        </button>
      </div>

      {message && (
        <p style={{ fontSize: 12, color: "#3b5bb5", margin: 0 }}>{message}</p>
      )}

      {/* Document list */}
      {loading ? (
        <div className="hm-empty" style={{ padding: "10px 0" }}>Loading...</div>
      ) : docs.length === 0 ? (
        <div className="hm-empty" style={{ padding: "10px 0" }}>
          No documents yet. Add from the Knowledge Base or drop a file above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((doc) => (
            <div
              key={doc.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            >
              <span style={{ fontSize: 16 }}>{TYPE_ICON[doc.type]}</span>
              <span style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 13,
                color: "#1f2937",
              }}>
                {doc.name}
              </span>
              <span className="kb-type">{typeLabel(doc)}</span>
              <button
                type="button"
                className="hm-x"
                aria-label="Remove"
                disabled={busy}
                onClick={() => removeDoc(doc.name)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassroomPicker({
  sources,
  refreshSources,
}: {
  sources: Source[];
  refreshSources: () => Promise<void>;
}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    refreshSources();
    fetchClassrooms()
      .then(setClassrooms)
      .catch(() => setError("Could not load classrooms. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [refreshSources]);

  const openChat = (id: number) => {
    window.location.hash = `/classroom/${id}/chat`;
  };

  return (
    <div className="page-content kb-page">
      <div className="kb-head">
        <div className="kb-title">
          <div className="sx-header-icon">🏫</div>
          <div>
            <h1>Classrooms</h1>
            <p>Manage documents and open chats for each classroom.</p>
          </div>
        </div>
      </div>

      {loading && <div className="hm-empty">Loading classrooms...</div>}
      {error && <p className="hm-error">{error}</p>}

      {!loading && !error && (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}