import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Page, SearchResult, Source } from "../../types";
import { uploadFile } from "../../services/uploadService";
import { addWebsite } from "../../services/websiteService";
import { searchDocuments } from "../../services/searchService";
import { askQuestion } from "../../services/askService";

type DashboardProps = {
  setPage: (page: Page) => void;
  sources: Source[];
  setSources: Dispatch<SetStateAction<Source[]>>;
  questionCount: number;
  setQuestionCount: Dispatch<SetStateAction<number>>;
};

type Filter = "all" | "documents" | "websites";

const EXAMPLES = [
  "What are the key findings?",
  "Summarize this document",
  "Compare information from different sources",
];

const TYPE_ICON: Record<Source["type"], string> = {
  PDF: "📕",
  DOCX: "📘",
  PPT: "📙",
  EXCEL: "📗",
  WEB: "🌐",
};

function sourceTypeFromName(name: string): Source["type"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "docx" || ext === "doc") return "DOCX";
  if (ext === "ppt" || ext === "pptx") return "PPT";

  if (["xlsx", "xls", "xlsm", "xltx", "csv"].includes(ext)) {
    return "EXCEL";
  }

  return "PDF";
}

function resultIcon(type: string | null): string {
  const t = (type ?? "").toLowerCase();

  if (t === "pdf") return "📕";
  if (t === "word" || t === "docx") return "📘";
  if (t === "ppt") return "📙";
  if (t === "excel") return "📗";
  if (t === "website" || t === "web") return "🌐";

  return "📄";
}

function matchPercent(distance: number | null): number {
  if (distance === null) return 0;

  return Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
}

export default function Dashboard({
  setPage,
  sources,
  setSources,
  questionCount,
  setQuestionCount,
}: DashboardProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [addStatus, setAddStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [askError, setAskError] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const addRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rememberSource = (source: Source) => {
    setSources((current) => [
      ...current.filter((item) => item.name !== source.name),
      source,
    ]);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;

    setBusy(true);
    setAddStatus(`Uploading ${file.name}...`);

    try {
      const data = await uploadFile(file);

      rememberSource({
        name: file.name,
        type: sourceTypeFromName(file.name),
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        chunks: data.chunks,
      });

      setAddStatus(`${file.name} added (${data.chunks} chunks).`);
    } catch (error) {
      console.error(error);
      setAddStatus("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleWebsite = async () => {
    const clean = url.trim();

    if (!clean || busy) return;

    setBusy(true);
    setAddStatus("Crawling and indexing...");

    try {
      const data = await addWebsite(clean);

      rememberSource({
        name: data.url ?? clean,
        type: "WEB",
        size: "Website",
        chunks: data.chunks,
      });

      setUrl("");
      setAddStatus(`Website added (${data.chunks} chunks).`);
    } catch (error) {
      console.error(error);
      setAddStatus("Could not add the website. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async (text: string) => {
    const q = text.trim();

    if (!q || asking) return;

    setQuestion(q);
    setAsking(true);
    setAnswer("");
    setAskError("");
    setResults([]);
    setSelected(null);

    const started = performance.now();

    const [found, asked] = await Promise.allSettled([
      searchDocuments(q, 5),
      askQuestion(q, 5),
    ]);

    if (found.status === "fulfilled") {
      const list: SearchResult[] = found.value.results ?? [];

      setResults(list);
      setSelected(list.length > 0 ? 0 : null);
    } else {
      setAskError("Search failed. Is the backend running?");
    }

    if (asked.status === "fulfilled") {
      setAnswer(asked.value.answer ?? "");
    } else if (found.status === "fulfilled") {
      setAskError(
        "Could not generate an answer. Check the backend and your GROQ_API_KEY."
      );
    }

    setElapsed((performance.now() - started) / 1000);
    setSearched(true);
    setQuestionCount((count) => count + 1);
    setAsking(false);
  };

  const websiteCount = sources.filter((s) => s.type === "WEB").length;
  const documentCount = sources.length - websiteCount;

  const shown = sources.filter((source) => {
    if (filter === "websites") return source.type === "WEB";
    if (filter === "documents") return source.type !== "WEB";
    return true;
  });

  const current = selected !== null ? results[selected] : undefined;

  return (
    <div className="page-content hm-page">
      <section className="hm-hero">
        <div className="hm-hero-text">
          <h1>
            Your Personal{" "}
            <span className="hm-accent">Knowledge Assistant</span>
          </h1>
          <p>
            Upload documents, add websites, and ask anything. iSmartRAG
            uses AI to find the most relevant information from your
            knowledge base.
          </p>
        </div>

        <div className="hm-hero-art" aria-hidden="true">
          <span className="hm-tile t1">🌐</span>
          <span className="hm-tile t2">📄</span>
          <span className="hm-tile t3">🔍</span>
        </div>
      </section>

      <div className="hm-row hm-row-2">
        <section ref={addRef} className="sx-card">
          <div className="sx-card-head">
            <div className="sx-card-icon">🗂️</div>
            <div>
              <h3>Add Knowledge</h3>
              <p>Upload documents or add a website to your knowledge base.</p>
            </div>
          </div>

          <div className="hm-add">
            <div
              className={`hm-drop ${dragging ? "drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <span className="hm-drop-icon">☁️</span>
              <span>Drop files here or</span>

              <button
                type="button"
                className="hm-primary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Browse Files
              </button>

              <small>Supports: PDF, DOCX, PPTX, XLSX, XLS, CSV</small>

              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.docx,.pptx,.xlsx,.xls,.xlsm,.xltx,.csv"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <span className="hm-or">OR</span>

            <div className="hm-site">
              <strong>🔗 Add Website</strong>

              <input
                className="sx-input full"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleWebsite();
                }}
              />

              <button
                type="button"
                className="sx-btn hm-full"
                disabled={busy}
                onClick={handleWebsite}
              >
                Crawl &amp; Index
              </button>
            </div>
          </div>

          {addStatus && <p className="hm-status">{addStatus}</p>}
        </section>

        <section className="sx-card">
          <div className="sx-card-head">
            <div className="sx-card-icon">🔍</div>
            <div>
              <h3>Ask a Question</h3>
              <p>Search through your documents and websites.</p>
            </div>
          </div>

          <div className="hm-ask">
            <textarea
              className="hm-textarea"
              placeholder="Ask anything about your knowledge..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runSearch(question);
                }
              }}
            />

            <button
              type="button"
              className="hm-primary hm-search-btn"
              disabled={asking}
              onClick={() => runSearch(question)}
            >
              {asking ? "Searching..." : "🔍 Search"}
            </button>
          </div>

          <p className="hm-examples-label">Try these examples:</p>

          <div className="hm-chips">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="hm-chip"
                onClick={() => runSearch(example)}
              >
                {example}
              </button>
            ))}
          </div>

          {answer && (
            <div className="hm-answer">
              <span className="hm-answer-label">ANSWER</span>
              {answer}
            </div>
          )}

          {askError && <p className="hm-error">{askError}</p>}

          <p className="hm-meta">
            Questions asked this session: {questionCount}
          </p>
        </section>
      </div>

      <div className="hm-row hm-row-3">
        <section className="sx-card">
          <div className="hm-head-row">
            <div className="sx-card-head hm-nomargin">
              <div className="sx-card-icon">📁</div>
              <div>
                <h3>Knowledge Base</h3>
                <p>{sources.length} sources this session</p>
              </div>
            </div>

            <button
              type="button"
              className="hm-primary hm-small"
              onClick={() =>
                addRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
            >
              + Add Source
            </button>
          </div>

          <div className="hm-tabs">
            <button
              type="button"
              className={`hm-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({sources.length})
            </button>
            <button
              type="button"
              className={`hm-tab ${filter === "documents" ? "active" : ""}`}
              onClick={() => setFilter("documents")}
            >
              Documents ({documentCount})
            </button>
            <button
              type="button"
              className={`hm-tab ${filter === "websites" ? "active" : ""}`}
              onClick={() => setFilter("websites")}
            >
              Websites ({websiteCount})
            </button>
          </div>

          <div className="hm-scroll">
            {shown.length === 0 && (
              <div className="hm-empty">
                No sources yet. Upload a file or add a website above.
              </div>
            )}

            {shown.map((source) => (
              <div key={source.name} className="hm-source">
                <span className="hm-file-icon">{TYPE_ICON[source.type]}</span>

                <div className="hm-source-info">
                  <strong>{source.name}</strong>
                  <small>
                    {source.type} •{" "}
                    {source.chunks !== undefined
                      ? `${source.chunks} chunks`
                      : source.size}
                  </small>
                </div>

                <span className="sx-pill ok">Indexed</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="hm-link"
            onClick={() => setPage("Knowledge Base")}
          >
            View all in Knowledge Base →
          </button>
        </section>

        <section className="sx-card">
          <div className="hm-head-row">
            <div className="sx-card-head hm-nomargin">
              <div className="sx-card-icon">📋</div>
              <div>
                <h3>Search Results</h3>
              </div>
            </div>

            {searched && (
              <span className="hm-meta">
                {results.length} results ({elapsed.toFixed(2)}s)
              </span>
            )}
          </div>

          <div className="hm-scroll">
            {!searched && !asking && (
              <div className="hm-empty">
                Ask a question to see the most relevant results here.
              </div>
            )}

            {asking && <div className="hm-empty">Searching...</div>}

            {searched && results.length === 0 && !asking && (
              <div className="hm-empty">
                No results. Upload a document first.
              </div>
            )}

            {results.map((result, index) => (
              <button
                key={index}
                type="button"
                className={`hm-result ${selected === index ? "active" : ""}`}
                onClick={() => setSelected(index)}
              >
                <span className="hm-rank">{index + 1}</span>

                <span className="hm-result-body">
                  <span className="hm-result-text">{result.text}</span>
                  <span className="hm-result-src">
                    {resultIcon(result.type)} {result.source ?? "Unknown"}
                  </span>
                </span>

                <span className="hm-match">
                  {matchPercent(result.distance)}% match
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="sx-card">
          <div className="hm-head-row">
            <div className="sx-card-head hm-nomargin">
              <div className="sx-card-icon">👁️</div>
              <div>
                <h3>Source Preview</h3>
              </div>
            </div>

            {current && (
              <button
                type="button"
                className="hm-x"
                aria-label="Close preview"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            )}
          </div>

          {!current && (
            <div className="hm-empty">
              Select a result to preview its source text.
            </div>
          )}

          {current && (
            <>
              <div className="hm-preview-head">
                <span className="hm-file-icon">{resultIcon(current.type)}</span>
                <div className="hm-source-info">
                  <strong>{current.source ?? "Unknown source"}</strong>
                  <small>
                    {(current.type ?? "document").toUpperCase()} •{" "}
                    {matchPercent(current.distance)}% match
                  </small>
                </div>
              </div>

              <div className="hm-preview-body">
                <p className="hm-preview-text">{current.text}</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}