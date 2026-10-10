  import { useEffect, useState } from "react";
  import type { ReactNode } from "react";
  import { API_BASE_URL } from "../../config/env";

  type ThemeChoice = "light" | "dark" | "system";
  type BackendState = "checking" | "online" | "offline";
  type TabKey = "general" | "kb" | "api";

  const STORAGE_KEY = "ismart-settings";

  // Read-only values that live in the backend.
  const CHUNK_SIZE = 800;
  const CHUNK_OVERLAP = 120;
  const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
  const ANSWER_MODEL = "openai/gpt-oss-120b";
  const FILE_TYPES = "PDF, DOCX, PPTX, XLSX, XLS, CSV";

  const TABS: { key: TabKey; icon: string; title: string; sub: string }[] = [
    { key: "general", icon: "\u2699\uFE0F", title: "General", sub: "Appearance" },
    { key: "kb", icon: "\uD83D\uDDC4\uFE0F", title: "Knowledge Base", sub: "Storage and processing" },
    { key: "api", icon: "\uD83D\uDD17", title: "API & Models", sub: "Backend connection" },
  ];

  function loadTheme(): ThemeChoice {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const theme = JSON.parse(saved).theme;
        if (theme === "light" || theme === "dark" || theme === "system") {
          return theme;
        }
      }

      if (localStorage.getItem("ismart-dark-mode") === "true") return "dark";
    } catch {
      // storage unavailable
    }

    return "light";
  }

  function applyTheme(choice: ThemeChoice) {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = choice === "dark" || (choice === "system" && systemDark);

    document.body.classList.toggle("dark-mode", isDark);

    try {
      localStorage.setItem("ismart-dark-mode", String(isDark));
    } catch {
      // storage unavailable
    }
  }

  // Apply the saved theme as soon as the app loads, not only when Settings opens.
  applyTheme(loadTheme());

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
    const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
    const [tab, setTab] = useState<TabKey>("general");
    const [backend, setBackend] = useState<BackendState>("checking");

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
      } catch {
        // storage unavailable
      }

      applyTheme(theme);

      if (theme !== "system") return;

      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");

      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }, [theme]);

    const checkBackend = async () => {
      setBackend("checking");

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
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

    const pillClass =
      backend === "online" ? "ok" : backend === "offline" ? "bad" : "idle";

    const pillText =
      backend === "online"
        ? "Connected"
        : backend === "offline"
        ? "Not reachable"
        : "Checking...";

    return (
      <div className="page-content sx-page">
        <div className="sx-header">
          <div className="sx-header-icon">{"\u2699\uFE0F"}</div>
          <div>
            <h1>Settings</h1>
            <p>Appearance, knowledge base details and backend connection.</p>
          </div>
        </div>

        <div className="sx-layout">
          <nav className="sx-menu">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sx-menu-item ${tab === item.key ? "active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                <span className="sx-menu-icon">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </span>
              </button>
            ))}
          </nav>

          <div className="sx-main" style={{ maxWidth: 820 }}>
            {tab === "general" && (
              <section className="sx-card">
                <CardHead
                  icon={"\u2699\uFE0F"}
                  title="General"
                  sub="Choose how the app looks. Saved in this browser."
                />

                <strong className="sx-label">Theme</strong>
                <div className="sx-themes">
                  {(
                    [
                      ["light", "\u2600\uFE0F", "Light"],
                      ["dark", "\uD83C\uDF19", "Dark"],
                      ["system", "\uD83D\uDDA5\uFE0F", "System"],
                    ] as const
                  ).map(([value, icon, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`sx-theme ${theme === value ? "active" : ""}`}
                      onClick={() => setTheme(value)}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === "kb" && (
              <section className="sx-card">
                <CardHead
                  icon={"\uD83D\uDDC4\uFE0F"}
                  title="Knowledge Base"
                  sub="How your documents are stored and processed. Set in the backend."
                />

                <Field title="Chunk size" hint="Characters per chunk">
                  <input
                    className="sx-input narrow"
                    value={CHUNK_SIZE}
                    disabled
                    readOnly
                  />
                </Field>

                <Field title="Chunk overlap" hint="Characters shared between chunks">
                  <input
                    className="sx-input narrow"
                    value={CHUNK_OVERLAP}
                    disabled
                    readOnly
                  />
                </Field>

                <Field title="Embedding model" hint="Used to index and search">
                  <input
                    className="sx-input"
                    value={EMBEDDING_MODEL}
                    disabled
                    readOnly
                  />
                </Field>

                <div className="sx-field-stack">
                  <strong className="sx-label">Supported file types</strong>
                  <input
                    className="sx-input full"
                    value={FILE_TYPES}
                    disabled
                    readOnly
                  />
                </div>

                <div className="sx-stats">
                  <div className="sx-stat">
                    <span>Total sources</span>
                    <strong>{sourceCount}</strong>
                  </div>
                </div>
              </section>
            )}

            {tab === "api" && (
              <section className="sx-card">
                <CardHead
                  icon={"\uD83D\uDD17"}
                  title="API & Models"
                  sub="The backend this app talks to."
                />

                <div className="sx-field-stack">
                  <strong className="sx-label">Backend URL</strong>
                  <input
                    className="sx-input full"
                    value={API_BASE_URL}
                    disabled
                    readOnly
                  />
                  <span className="sx-hint">
                    Set in frontend/src/config/env.ts
                  </span>
                </div>

                <div className="sx-field-stack">
                  <strong className="sx-label">Answer model</strong>
                  <input
                    className="sx-input full"
                    value={ANSWER_MODEL}
                    disabled
                    readOnly
                  />
                  <span className="sx-hint">Set in the backend</span>
                </div>

                <div className="sx-check">
                  <button type="button" className="sx-btn" onClick={checkBackend}>
                    Test connection
                  </button>

                  <span className={`sx-pill ${pillClass}`}>{pillText}</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }