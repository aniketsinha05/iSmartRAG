import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type ThemeChoice = "light" | "dark" | "system";
type BackendState = "checking" | "online" | "offline";

type Prefs = {
  theme: ThemeChoice;
  language: string;
  dateFormat: string;
  timeFormat: string;
  welcomeTips: boolean;
  notifications: boolean;
  defaultResults: number;
  maxResults: number;
  searchType: string;
  showScores: boolean;
  highlightTerms: boolean;
  autoAnswer: boolean;
  reranking: boolean;
  crawlLimit: number;
  backendUrl: string;
  timeout: number;
};

const STORAGE_KEY = "ismart-settings";

const DEFAULTS: Prefs = {
  theme: "light",
  language: "English",
  dateFormat: "Sep 30, 2026 (Default)",
  timeFormat: "24 hour (14:30)",
  welcomeTips: true,
  notifications: true,
  defaultResults: 3,
  maxResults: 10,
  searchType: "Semantic Search",
  showScores: true,
  highlightTerms: true,
  autoAnswer: false,
  reranking: false,
  crawlLimit: 50,
  backendUrl: "http://localhost:8000",
  timeout: 60,
};

// These values are set in the backend (vector_store.py / generate_answer.py)
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const ANSWER_MODEL = "openai/gpt-oss-120b";

const MENU: {
  key: string;
  icon: string;
  title: string;
  sub: string;
  target: string | null;
}[] = [
  { key: "general", icon: "⚙️", title: "General", sub: "Appearance and basic settings", target: "sx-general" },
  { key: "search", icon: "🔍", title: "Search", sub: "Search behaviour and results", target: "sx-search" },
  { key: "kb", icon: "🗄️", title: "Knowledge Base", sub: "Database and storage settings", target: "sx-kb" },
  { key: "api", icon: "🔗", title: "API & Models", sub: "Backend API configuration", target: "sx-api" },
  { key: "app", icon: "▦", title: "Application", sub: "App preferences", target: null },
  { key: "data", icon: "🗂️", title: "Data Management", sub: "Export, import and cleanup", target: null },
  { key: "account", icon: "👤", title: "Account", sub: "User profile and access", target: null },
  { key: "about", icon: "ℹ️", title: "About", sub: "Version and system information", target: null },
];

function loadPrefs(): Prefs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return { ...DEFAULTS, ...JSON.parse(saved) };
    }

    if (localStorage.getItem("ismart-dark-mode") === "true") {
      return { ...DEFAULTS, theme: "dark" };
    }
  } catch {
    // storage not available, use defaults
  }

  return DEFAULTS;
}

function applyTheme(choice: ThemeChoice) {
  const systemDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  const isDark =
    choice === "dark" || (choice === "system" && systemDark);

  document.body.classList.toggle("dark-mode", isDark);

  try {
    localStorage.setItem("ismart-dark-mode", String(isDark));
  } catch {
    // storage not available
  }
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <i></i>
    </button>
  );
}

function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="sx-field">
      <div>
        <strong>{title}</strong>
        {hint && <span className="sx-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function CardHead({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="sx-card-head">
      <div className="sx-card-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </div>
  );
}

export default function Settings({
  sourceCount = 0,
}: {
  sourceCount?: number;
}) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [activeMenu, setActiveMenu] = useState("general");
  const [notice, setNotice] = useState("");
  const [backend, setBackend] = useState<BackendState>("checking");

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // storage not available
    }
  }, [prefs]);

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  const checkBackend = async () => {
    setBackend("checking");

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      Math.max(1, prefs.timeout) * 1000
    );

    try {
      const base = prefs.backendUrl.replace(/\/+$/, "");
      const response = await fetch(`${base}/health`, {
        signal: controller.signal,
      });

      setBackend(response.ok ? "online" : "offline");
    } catch {
      setBackend("offline");
    } finally {
      window.clearTimeout(timer);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  const openMenu = (item: (typeof MENU)[number]) => {
    setActiveMenu(item.key);

    if (item.target) {
      setNotice("");
      document
        .getElementById(item.target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setNotice(`${item.title} settings are coming soon.`);
    }
  };

  const online = backend === "online";
  const dependent = online ? "ok" : "idle";
  const dependentText = online ? "Available" : "Unknown";

  return (
    <div className="page-content sx-page">
      <div className="sx-header">
        <div className="sx-header-icon">⚙️</div>
        <div>
          <h1>Settings</h1>
          <p>
            Configure your application preferences, search options and
            system settings.
          </p>
        </div>
      </div>

      <p className="sx-note">
        Preferences are saved in this browser. Chunk size, overlap and the
        answer model are set in the backend for now.
      </p>

      <div className="sx-layout">
        <nav className="sx-menu">
          {MENU.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sx-menu-item ${
                activeMenu === item.key ? "active" : ""
              }`}
              onClick={() => openMenu(item)}
            >
              <span className="sx-menu-icon">{item.icon}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.sub}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sx-main">
          <div className="sx-row sx-row-2">
            <section id="sx-general" className="sx-card">
              <CardHead
                icon="⚙️"
                title="General Settings"
                sub="Customize the appearance and general behaviour of the application."
              />

              <strong className="sx-label">Theme</strong>
              <div className="sx-themes">
                {(
                  [
                    ["light", "☀️", "Light"],
                    ["dark", "🌙", "Dark"],
                    ["system", "🖥️", "System"],
                  ] as const
                ).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`sx-theme ${
                      prefs.theme === value ? "active" : ""
                    }`}
                    onClick={() => update("theme", value)}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <Field title="Language">
                <select
                  className="sx-select"
                  value={prefs.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  <option>English</option>
                </select>
              </Field>

              <Field title="Date Format">
                <select
                  className="sx-select"
                  value={prefs.dateFormat}
                  onChange={(e) => update("dateFormat", e.target.value)}
                >
                  <option>Sep 30, 2026 (Default)</option>
                  <option>30/09/2026</option>
                  <option>2026-09-30</option>
                </select>
              </Field>

              <Field title="Time Format">
                <select
                  className="sx-select"
                  value={prefs.timeFormat}
                  onChange={(e) => update("timeFormat", e.target.value)}
                >
                  <option>24 hour (14:30)</option>
                  <option>12 hour (2:30 PM)</option>
                </select>
              </Field>

              <Field
                title="Show welcome tips"
                hint="Display helpful tips on key pages"
              >
                <Switch
                  on={prefs.welcomeTips}
                  onChange={(v) => update("welcomeTips", v)}
                  label="Show welcome tips"
                />
              </Field>

              <Field
                title="Enable notifications"
                hint="Show in-app notifications for indexing and search"
              >
                <Switch
                  on={prefs.notifications}
                  onChange={(v) => update("notifications", v)}
                  label="Enable notifications"
                />
              </Field>
            </section>

            <section id="sx-search" className="sx-card">
              <CardHead
                icon="🔍"
                title="Search Settings"
                sub="Configure how search and question answering works."
              />

              <Field
                title="Default number of results"
                hint="Number of results shown per search"
              >
                <select
                  className="sx-select"
                  value={prefs.defaultResults}
                  onChange={(e) =>
                    update("defaultResults", Number(e.target.value))
                  }
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </Field>

              <Field
                title="Maximum number of results"
                hint="Maximum results allowed per search"
              >
                <select
                  className="sx-select"
                  value={prefs.maxResults}
                  onChange={(e) =>
                    update("maxResults", Number(e.target.value))
                  }
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </Field>

              <Field
                title="Search type"
                hint="Type of search to perform"
              >
                <select
                  className="sx-select"
                  value={prefs.searchType}
                  onChange={(e) => update("searchType", e.target.value)}
                >
                  <option>Semantic Search</option>
                </select>
              </Field>

              <Field
                title="Show similarity scores"
                hint="Display relevance scores for results"
              >
                <Switch
                  on={prefs.showScores}
                  onChange={(v) => update("showScores", v)}
                  label="Show similarity scores"
                />
              </Field>

              <Field
                title="Highlight search terms"
                hint="Highlight relevant text in results"
              >
                <Switch
                  on={prefs.highlightTerms}
                  onChange={(v) => update("highlightTerms", v)}
                  label="Highlight search terms"
                />
              </Field>

              <Field
                title="Auto-generate answer"
                hint="Generate AI answer from top results (if enabled)"
              >
                <Switch
                  on={prefs.autoAnswer}
                  onChange={(v) => update("autoAnswer", v)}
                  label="Auto-generate answer"
                />
              </Field>

              <Field
                title="Use reranking (if available)"
                hint="Improve result quality using reranking"
              >
                <Switch
                  on={prefs.reranking}
                  onChange={(v) => update("reranking", v)}
                  label="Use reranking"
                />
              </Field>
            </section>
          </div>

          <div className="sx-row sx-row-3">
            <section id="sx-kb" className="sx-card">
              <CardHead
                icon="🗄️"
                title="Knowledge Base Settings"
                sub="Configure storage and processing settings."
              />

              <Field
                title="Chunk size"
                hint="Number of characters per chunk (set in backend)"
              >
                <input
                  className="sx-input narrow"
                  value={CHUNK_SIZE}
                  disabled
                  readOnly
                />
              </Field>

              <Field
                title="Chunk overlap"
                hint="Number of overlapping characters (set in backend)"
              >
                <input
                  className="sx-input narrow"
                  value={CHUNK_OVERLAP}
                  disabled
                  readOnly
                />
              </Field>

              <div className="sx-field-stack">
                <strong className="sx-label">Supported file types</strong>
                <input
                  className="sx-input full"
                  value="PDF, DOCX, PPTX, XLSX, XLS, CSV"
                  disabled
                  readOnly
                />
                <span className="sx-hint">
                  File types supported for upload
                </span>
              </div>

              <Field
                title="Website crawl limit"
                hint="Maximum number of pages to crawl per website"
              >
                <input
                  className="sx-input narrow"
                  type="number"
                  min={1}
                  value={prefs.crawlLimit}
                  onChange={(e) =>
                    update("crawlLimit", Number(e.target.value))
                  }
                />
              </Field>
            </section>

            <section id="sx-api" className="sx-card">
              <CardHead
                icon="🔗"
                title="API & Model Settings"
                sub="Configure backend API and model preferences."
              />

              <div className="sx-field-stack">
                <strong className="sx-label">Backend URL</strong>
                <input
                  className="sx-input full"
                  value={prefs.backendUrl}
                  onChange={(e) => update("backendUrl", e.target.value)}
                />
                <span className="sx-hint">URL of the FastAPI backend</span>
              </div>

              <Field
                title="API Timeout (seconds)"
                hint="Request timeout for API calls"
              >
                <input
                  className="sx-input narrow"
                  type="number"
                  min={1}
                  value={prefs.timeout}
                  onChange={(e) =>
                    update("timeout", Number(e.target.value))
                  }
                />
              </Field>

              <div className="sx-field-stack">
                <strong className="sx-label">LLM Model (for answers)</strong>
                <select className="sx-select full" value={ANSWER_MODEL} disabled>
                  <option>{ANSWER_MODEL}</option>
                </select>
                <span className="sx-hint">
                  Model used for generating answers (set in backend)
                </span>
              </div>

              <div className="sx-check">
                <button
                  type="button"
                  className="sx-btn"
                  onClick={checkBackend}
                >
                  Test Connection
                </button>

                <span
                  className={`sx-pill ${
                    backend === "online"
                      ? "ok"
                      : backend === "offline"
                      ? "bad"
                      : "idle"
                  }`}
                >
                  {backend === "online"
                    ? "Connected"
                    : backend === "offline"
                    ? "Not reachable"
                    : "Checking..."}
                </span>
              </div>
            </section>

            <section className="sx-card">
              <CardHead
                icon="📈"
                title="System Status"
                sub="Current system health and component status."
              />

              <div className="sx-status-item">
                <div>
                  <strong>Backend API</strong>
                  <span className="sx-hint">FastAPI server</span>
                </div>
                <span
                  className={`sx-pill ${
                    online
                      ? "ok"
                      : backend === "offline"
                      ? "bad"
                      : "idle"
                  }`}
                >
                  {online
                    ? "Online"
                    : backend === "offline"
                    ? "Offline"
                    : "Checking..."}
                </span>
              </div>

              <div className="sx-status-item">
                <div>
                  <strong>FAISS Vector Store</strong>
                  <span className="sx-hint">Vector database</span>
                </div>
                <span className={`sx-pill ${dependent}`}>
                  {dependentText}
                </span>
              </div>

              <div className="sx-status-item">
                <div>
                  <strong>Storage</strong>
                  <span className="sx-hint">Persistent storage</span>
                </div>
                <span className={`sx-pill ${dependent}`}>
                  {dependentText}
                </span>
              </div>

              <div className="sx-status-item">
                <div>
                  <strong>Embedding Model</strong>
                  <span className="sx-hint">all-MiniLM-L6-v2</span>
                </div>
                <span className={`sx-pill ${dependent}`}>
                  {dependentText}
                </span>
              </div>

              <div className="sx-stats">
                <div className="sx-stat">
                  <span>Total Chunks</span>
                  <strong>—</strong>
                </div>
                <div className="sx-stat">
                  <span>Total Sources</span>
                  <strong>{sourceCount}</strong>
                </div>
              </div>
            </section>
          </div>

          {notice && <p className="sx-note">{notice}</p>}
        </div>
      </div>
    </div>
  );
}