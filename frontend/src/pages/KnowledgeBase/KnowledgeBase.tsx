import { useEffect, useState } from "react";
import type { Page, Source } from "../../types";
import {
  deleteSourceByName,
  fetchSourceContent,
} from "../../services/sourcesService";

type KnowledgeBaseProps = {
  sources: Source[];
  refreshSources: () => Promise<void>;
  setPage: (page: Page) => void;
};

type Tab = "all" | "documents" | "websites";
type SortKey = "date" | "name" | "chunks" | "size";
type PanelTab = "overview" | "content";

const PAGE_SIZE = 10;

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

export default function KnowledgeBase({
  sources,
  refreshSources,
  setPage,
}: KnowledgeBaseProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDesc, setSortDesc] = useState(true);
  const [pageNo, setPageNo] = useState(1);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("overview");
  const [content, setContent] = useState<string[] | null>(null);
  const [contentError, setContentError] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  useEffect(() => {
    if (!selectedName || panelTab !== "content") return;

    let cancelled = false;

    setContent(null);
    setContentError("");

    fetchSourceContent(selectedName)
      .then((chunks) => {
        if (!cancelled) setContent(chunks);
      })
      .catch(() => {
        if (!cancelled) setContentError("Could not load the content.");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedName, panelTab]);

  const websites = sources.filter((s) => s.type === "WEB");
  const documentCount = sources.length - websites.length;
  const totalChunks = sources.reduce((sum, s) => sum + (s.chunks ?? 0), 0);

  const fileTypes = Array.from(
    new Set(sources.filter((s) => s.type !== "WEB").map(typeLabel))
  );

  const typeOptions = Array.from(new Set(sources.map(typeLabel)));

  const filtered = sources.filter((source) => {
    if (tab === "documents" && source.type === "WEB") return false;
    if (tab === "websites" && source.type !== "WEB") return false;
    if (typeFilter !== "all" && typeLabel(source) !== typeFilter) return false;

    return source.name.toLowerCase().includes(search.trim().toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    let result = 0;

    if (sortKey === "name") {
      result = a.name.localeCompare(b.name);
    } else if (sortKey === "chunks") {
      result = (a.chunks ?? 0) - (b.chunks ?? 0);
    } else if (sortKey === "size") {
      result = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
    } else {
      result =
        (Date.parse(a.addedAt ?? "") || 0) -
        (Date.parse(b.addedAt ?? "") || 0);
    }

    return sortDesc ? -result : result;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(pageNo, pages);
  const rows = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selected = sources.find((s) => s.name === selectedName);

  const openSource = (source: Source) => {
    setSelectedName(source.name);
    setPanelTab("overview");
    setContent(null);
    setContentError("");
  };

  const removeSource = async (source: Source) => {
    const ok = window.confirm(
      `Remove "${source.name}" from the knowledge base?`
    );

    if (!ok) return;

    setBusy(true);
    setMessage("");

    try {
      await deleteSourceByName(source.name);
      setSelectedName(null);
      await refreshSources();
      setMessage(`${source.name} was removed.`);
    } catch (error) {
      console.error(error);
      setMessage("Could not remove the source. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-content kb-page">
      <div className="kb-head">
        <div className="kb-title">
          <div className="sx-header-icon">📦</div>
          <div>
            <h1>Knowledge Base</h1>
            <p>
              Manage and explore all your indexed documents and websites.
              View details, search within sources, and remove sources when
              needed.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="hm-primary"
          onClick={() => setPage("Dashboard")}
        >
          + Add Source
        </button>
      </div>

      <div className="kb-stats">
        <div className="kb-stat">
          <div className="kb-stat-icon">📄</div>
          <div>
            <span>Total Sources</span>
            <strong>{sources.length}</strong>
            <small>
              {documentCount} documents • {websites.length} websites
            </small>
          </div>
        </div>

        <div className="kb-stat">
          <div className="kb-stat-icon">🗄️</div>
          <div>
            <span>Total Chunks</span>
            <strong>{totalChunks.toLocaleString()}</strong>
            <small>Across all sources</small>
          </div>
        </div>

        <div className="kb-stat">
          <div className="kb-stat-icon">🗂️</div>
          <div>
            <span>File Types</span>
            <strong>{fileTypes.length}</strong>
            <small>{fileTypes.join(", ") || "None yet"}</small>
          </div>
        </div>

        <div className="kb-stat">
          <div className="kb-stat-icon">🌐</div>
          <div>
            <span>Web Sources</span>
            <strong>{websites.length}</strong>
            <small>Indexed websites</small>
          </div>
        </div>
      </div>

      {message && <p className="sx-note">{message}</p>}

      <div className="kb-toolbar">
        {(
          [
            ["all", `All Sources (${sources.length})`],
            ["documents", `Documents (${documentCount})`],
            ["websites", `Websites (${websites.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`hm-tab ${tab === value ? "active" : ""}`}
            onClick={() => {
              setTab(value);
              setPageNo(1);
            }}
          >
            {label}
          </button>
        ))}

        <input
          className="sx-input kb-search"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageNo(1);
          }}
        />

        <select
          className="sx-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPageNo(1);
          }}
        >
          <option value="all">All types</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="sx-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="date">Date Added</option>
          <option value="name">Name</option>
          <option value="chunks">Chunks</option>
          <option value="size">Size</option>
        </select>

        <button
          type="button"
          className="sx-btn"
          aria-label="Reverse sort order"
          onClick={() => setSortDesc((value) => !value)}
        >
          {sortDesc ? "↓" : "↑"}
        </button>
      </div>

      <div className={`kb-layout ${selected ? "has-panel" : ""}`}>
        <section className="sx-card">
          {sorted.length === 0 ? (
            <div className="hm-empty">
              {sources.length === 0
                ? "No sources yet. Click Add Source to upload a file or add a website."
                : "No sources match your filters."}
            </div>
          ) : (
            <div className="kb-table-wrap">
              <table className="kb-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Chunks</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Added At</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((source) => (
                    <tr
                      key={source.name}
                      className={`kb-row ${
                        selectedName === source.name ? "active" : ""
                      }`}
                      onClick={() => openSource(source)}
                    >
                      <td>
                        <div className="kb-name">
                          <span className="hm-file-icon">
                            {TYPE_ICON[source.type]}
                          </span>
                          <div>
                            <strong>{source.name}</strong>
                            <small>
                              {source.type === "WEB"
                                ? "Website"
                                : `${typeLabel(source)} document`}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="kb-type">{typeLabel(source)}</span>
                      </td>
                      <td>{source.chunks ?? "—"}</td>
                      <td>{source.size}</td>
                      <td>
                        <span className="sx-pill ok">Indexed</span>
                      </td>
                      <td>{formatDate(source.addedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="kb-footer">
            <span>
              Showing{" "}
              {sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, sorted.length)} of{" "}
              {sorted.length} sources
            </span>

            <div className="kb-pager">
              <button
                type="button"
                className="kb-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPageNo(currentPage - 1)}
              >
                ‹
              </button>

              {Array.from({ length: pages }, (_, i) => i + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  className={`kb-page-btn ${
                    number === currentPage ? "active" : ""
                  }`}
                  onClick={() => setPageNo(number)}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                className="kb-page-btn"
                disabled={currentPage >= pages}
                onClick={() => setPageNo(currentPage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </section>

        {selected && (
          <aside className="sx-card kb-panel">
            <div className="kb-panel-head">
              <span className="hm-file-icon">{TYPE_ICON[selected.type]}</span>

              <div className="hm-source-info">
                <strong>{selected.name}</strong>
                <small>
                  {selected.type === "WEB"
                    ? "Website"
                    : `${typeLabel(selected)} document`}
                </small>
              </div>

              <span className="sx-pill ok">Indexed</span>

              <button
                type="button"
                className="hm-x"
                aria-label="Close details"
                onClick={() => setSelectedName(null)}
              >
                ✕
              </button>
            </div>

            <div className="kb-panel-tabs">
              <button
                type="button"
                className={`kb-panel-tab ${
                  panelTab === "overview" ? "active" : ""
                }`}
                onClick={() => setPanelTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`kb-panel-tab ${
                  panelTab === "content" ? "active" : ""
                }`}
                onClick={() => setPanelTab("content")}
              >
                Content
              </button>
            </div>

            {panelTab === "overview" && (
              <>
                <div className="kb-info">
                  <div>
                    <span>Type</span>
                    <strong>{typeLabel(selected)}</strong>
                  </div>
                  <div>
                    <span>Chunks</span>
                    <strong>{selected.chunks ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Size</span>
                    <strong>{selected.size}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>Indexed</strong>
                  </div>
                  <div>
                    <span>Added At</span>
                    <strong>{formatDate(selected.addedAt)}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{selected.name}</strong>
                  </div>
                </div>

                <h4 className="kb-sub">Quick Actions</h4>

                <div className="kb-actions">
                  <button
                    type="button"
                    className="kb-action"
                    onClick={() => setPanelTab("content")}
                  >
                    👁️ View Content
                  </button>

                  <button
                    type="button"
                    className="kb-action danger"
                    disabled={busy}
                    onClick={() => removeSource(selected)}
                  >
                    🗑️ Remove Source
                  </button>
                </div>
              </>
            )}

            {panelTab === "content" && (
              <div className="kb-chunks">
                {!content && !contentError && (
                  <div className="hm-empty">Loading content...</div>
                )}

                {contentError && <p className="hm-error">{contentError}</p>}

                {content &&
                  content.map((chunk, index) => (
                    <div key={index} className="kb-chunk">
                      <small>Chunk {index + 1}</small>
                      {chunk}
                    </div>
                  ))}

                {content && content.length >= 20 && (
                  <p className="hm-meta">Showing the first 20 chunks.</p>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}