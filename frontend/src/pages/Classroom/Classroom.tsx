import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import type { Classroom, Page, Source } from "../../types";
import {
  fetchClassroomDocuments,
  importDocuments,
  removeClassroomDocument,
  uploadToClassroom,
} from "../../services/classroomService";

type ClassroomPageProps = {
  classroomId: number;
  sources: Source[];
  refreshSources: () => Promise<void>;
  setPage: (page: Page) => void;
  setQuestionCount: Dispatch<SetStateAction<number>>;
};

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.xlsm,.xltx,.xls,.csv";

const TYPE_ICON: Record<Source["type"], string> = {
  PDF: "📕",
  DOCX: "📘",
  PPT: "📙",
  EXCEL: "📗",
  WEB: "🌐",
};

function typeLabel(source: Source): string {
  if (source.type === "WEB") return "Website";
  if (source.type === "EXCEL") {
    return source.name.toLowerCase().endsWith(".csv") ? "CSV" : "Excel";
  }
  return source.type;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ClassroomPage({
  classroomId,
  sources,
  refreshSources,
  setPage,
  setQuestionCount: _setQuestionCount,
}: ClassroomPageProps) {
  const [room, setRoom] = useState<Classroom | null>(null);
  const [docs, setDocs] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickSearch, setPickSearch] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const roomName = room?.name ?? `Classroom ${classroomId}`;

  const load = useCallback(async () => {
    try {
      const data = await fetchClassroomDocuments(classroomId);
      setRoom(data.classroom);
      setDocs(data.documents);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not load this classroom. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    load();
    refreshSources();
  }, [load, refreshSources]);

  useEffect(() => {
    if (!importOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importOpen]);

  const inClassroom = new Set(docs.map((d) => d.name));

  const available = sources.filter((s) =>
    s.name.toLowerCase().includes(pickSearch.trim().toLowerCase())
  );

  const openImport = () => {
    setPicked([]);
    setPickSearch("");
    setImportOpen(true);
  };

  const togglePick = (name: string) => {
    setPicked((current) =>
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name]
    );
  };

  const confirmImport = async () => {
    if (picked.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await importDocuments(classroomId, picked);
      await load();
      setImportOpen(false);
      setMessage(
        `Added ${result.added.length} document${result.added.length === 1 ? "" : "s"} to ${roomName}.` +
          (result.skipped.length > 0
            ? ` ${result.skipped.length} already in this classroom.`
            : "")
      );
    } catch (err) {
      console.error(err);
      setMessage("Could not import the documents. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (doc: Source) => {
    const ok = window.confirm(
      `Remove "${doc.name}" from ${roomName}? The original stays in the Knowledge Base and in other classrooms.`
    );
    if (!ok) return;
    setBusy(true);
    setMessage("");
    try {
      await removeClassroomDocument(classroomId, doc.name);
      await load();
      setMessage(`${doc.name} was removed from ${roomName}.`);
    } catch (err) {
      console.error(err);
      setMessage("Could not remove the document. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      await uploadToClassroom(classroomId, file);
      await load();
      await refreshSources();
      setMessage(
        `${file.name} was added to ${roomName}. It is also saved in the Knowledge Base.`
      );
    } catch (err) {
      console.error(err);
      setMessage(
        "Could not upload the file. Check the file type and that the backend is running."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-content kb-page cr-page">
      <div className="kb-head">
        <div className="kb-title">
          <div className="sx-header-icon">🏫</div>
          <div>
            <h1>{roomName}</h1>
            <p>
              Manage the documents in this classroom. To chat, use the button
              below — answers will be scoped to this classroom's files only.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="sx-btn"
          onClick={() => setPage("Knowledge Base")}
        >
          ← Knowledge Base
        </button>
      </div>

      {/* Toolbar — documents count + Chat shortcut */}
      <div className="kb-toolbar">
        <span className="cp-name">Documents ({docs.length})</span>

        <button
          type="button"
          className="hm-primary hm-small"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            try {
              sessionStorage.setItem("mybookai-fresh-chat", "1");
              localStorage.setItem("mybookai-chat-scope", String(classroomId));
            } catch {}
            window.location.hash = "/chat";
          }}
        >
          💬 Chat with {roomName}
        </button>
      </div>

      {message && <p className="sx-note">{message}</p>}

      {/* Documents section — always visible, no tab switching */}
      <section className="sx-card">
        <div className="cr-bar">
          <strong>
            {docs.length} document{docs.length === 1 ? "" : "s"} in {roomName}
          </strong>

          <div className="cr-bar-actions">
            <button
              type="button"
              className="hm-primary"
              disabled={busy}
              onClick={openImport}
            >
              Import from Knowledge Base
            </button>

            <button
              type="button"
              className="sx-btn"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Upload file
            </button>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={onUpload}
            />
          </div>
        </div>

        {loading && <div className="hm-empty">Loading documents...</div>}

        {error && <p className="hm-error">{error}</p>}

        {!loading && !error && docs.length === 0 && (
          <div className="hm-empty">
            No documents yet. Import from the Knowledge Base or upload a file.
            Until then, the classroom chat will not find any answers.
          </div>
        )}

        {docs.length > 0 && (
          <div className="kb-table-wrap">
            <table className="kb-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Chunks</th>
                  <th>Size</th>
                  <th>Added At</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.name}>
                    <td>
                      <div className="kb-name">
                        <span className="hm-file-icon">
                          {TYPE_ICON[doc.type]}
                        </span>
                        <div>
                          <strong>{doc.name}</strong>
                          <small>
                            {doc.type === "WEB"
                              ? "Website"
                              : `${typeLabel(doc)} document`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="kb-type">{typeLabel(doc)}</span>
                    </td>
                    <td>{doc.chunks ?? "—"}</td>
                    <td>{doc.size}</td>
                    <td>{formatDate(doc.addedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="kb-action danger"
                        disabled={busy}
                        onClick={() => removeDoc(doc)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Import modal */}
      {importOpen && (
        <div
          className="cr-overlay"
          onClick={() => {
            if (!busy) setImportOpen(false);
          }}
        >
          <div
            className="cr-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Import from Knowledge Base"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cr-modal-head">
              <h3>Import from Knowledge Base</h3>
              <button
                type="button"
                className="hm-x"
                aria-label="Close"
                onClick={() => setImportOpen(false)}
              >
                ✕
              </button>
            </div>

            <p className="hm-meta">
              Choose documents to add to {roomName}. The files are not copied,
              so the same document can be used in several classrooms.
            </p>

            <input
              className="sx-input"
              placeholder="Search documents..."
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
            />

            <div className="cr-list">
              {available.length === 0 ? (
                <div className="hm-empty">
                  {sources.length === 0
                    ? "The Knowledge Base is empty. Add a source first."
                    : "No documents match your search."}
                </div>
              ) : (
                available.map((source) => {
                  const already = inClassroom.has(source.name);
                  return (
                    <label
                      key={source.name}
                      className={`cr-item ${already ? "disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={already || picked.includes(source.name)}
                        disabled={already || busy}
                        onChange={() => togglePick(source.name)}
                      />
                      <span className="hm-file-icon">
                        {TYPE_ICON[source.type]}
                      </span>
                      <span className="cr-item-info">
                        <strong>{source.name}</strong>
                        <small>
                          {typeLabel(source)} • {source.size}
                          {already ? " • Already in this classroom" : ""}
                        </small>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="cr-modal-foot">
              <button
                type="button"
                className="sx-btn"
                disabled={busy}
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hm-primary"
                disabled={busy || picked.length === 0}
                onClick={confirmImport}
              >
                {busy
                  ? "Importing..."
                  : `Import${picked.length ? ` (${picked.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}