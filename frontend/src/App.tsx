import { useState } from "react";
import "./App.css";

type Page = "Dashboard" | "Knowledge Base" | "Chat" | "Quiz" | "Settings";

type Source = {
  name: string;
  type: "PDF" | "DOCX" | "PPT" | "WEB";
  size: string;
};

type Message = {
  role: "user" | "ai";
  text: string;
};

function Topbar({
  page,
  onMenu,
}: {
  page: Page;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu}>
        ☰
      </button>

      <div>
        <h2>{page}</h2>
        <p>Welcome to iSmartRAG</p>
      </div>
    </header>
  );
}

function Sidebar({
  page,
  setPage,
  mobileOpen,
  setMobileOpen,
}: {
  page: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
}) {
  const menuItems: { label: Page; icon: string }[] = [
    { label: "Dashboard", icon: "⌂" },
    { label: "Knowledge Base", icon: "▣" },
    { label: "Chat", icon: "◌" },
    { label: "Quiz", icon: "✓" },
    { label: "Settings", icon: "⚙" },
  ];

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark small">iS</div>

        <div>
          <strong>iSmartRAG</strong>
          <span>Learning Assistant</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-title">MENU</span>

        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${page === item.label ? "active" : ""}`}
            onClick={() => {
              setPage(item.label);
              setMobileOpen(false);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="nav-item logout"
          onClick={() => setPage("Dashboard")}
        >
          <span className="nav-icon">↪</span>
          Dashboard
        </button>
      </div>
    </aside>
  );
}

function Stat({
  number,
  label,
  icon,
}: {
  number: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <strong>{number}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="feature-card" onClick={onClick}>
      <div className="feature-icon">{icon}</div>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <span className="feature-arrow">→</span>
    </button>
  );
}

function Dashboard({
  setPage,
  sourceCount,
  questionCount,
  quizCount,
}: {
  setPage: (page: Page) => void;
  sourceCount: number;
  questionCount: number;
  quizCount: number;
}) {
  return (
    <div className="page-content">
      <section className="hero-banner">
        <div className="hero-content">
          <span className="hero-label">YOUR AI STUDY ASSISTANT</span>

          <h1>Study smarter with iSmartRAG</h1>

          <p>
            Upload your study material, ask questions and test your
            knowledge using your own personalized knowledge base.
          </p>

          <button
            className="hero-btn"
            onClick={() => setPage("Knowledge Base")}
          >
            Build Knowledge Base →
          </button>
        </div>

        <div className="hero-decoration">
          <div className="floating-card card-one">📚</div>
          <div className="floating-card card-two">💡</div>
          <div className="hero-orb">AI</div>
        </div>
      </section>

      <div className="stats-grid">
        <Stat number={String(sourceCount)} label="Sources" icon="📄" />
        <Stat number={String(questionCount)} label="Questions Asked" icon="💬" />
        <Stat number={String(quizCount)} label="Quizzes Completed" icon="✓" />
        <Stat number="0" label="Study Sessions" icon="🧠" />
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>What would you like to do?</h2>
            <p>Choose a learning activity to get started.</p>
          </div>
        </div>

        <div className="feature-grid">
          <Feature
            icon="📚"
            title="Knowledge Base"
            description="Upload documents and add websites to your study collection."
            onClick={() => setPage("Knowledge Base")}
          />

          <Feature
            icon="✨"
            title="Ask iSmartRAG"
            description="Ask questions and get answers from your study material."
            onClick={() => setPage("Chat")}
          />

          <Feature
            icon="🧠"
            title="Take a Quiz"
            description="Test yourself with questions based on your knowledge base."
            onClick={() => setPage("Quiz")}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Recent Activity</h2>
            <p>Your latest learning activity.</p>
          </div>
        </div>

        <div className="activity-card">
          <div className="empty-state">
            <div>📭</div>
            <h3>No activity yet</h3>
            <p>
              Your uploaded sources, questions and quiz activity will
              appear here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function KnowledgeBase({
  sources,
  setSources,
}: {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
}) {
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");

  const addFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const extension = file.name
      .split(".")
      .pop()
      ?.toUpperCase();

    let type: Source["type"] = "PDF";

    if (extension === "DOCX" || extension === "DOC") {
      type = "DOCX";
    }

    if (extension === "PPT" || extension === "PPTX") {
      type = "PPT";
    }

    const newSource: Source = {
      name: file.name,
      type,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    };

    setSources((current) => [...current, newSource]);

    event.target.value = "";
  };

  const addUrl = () => {
    const cleanUrl = url.trim();

    if (!cleanUrl) return;

    const newSource: Source = {
      name: cleanUrl,
      type: "WEB",
      size: "Website",
    };

    setSources((current) => [...current, newSource]);
    setUrl("");
  };

  const deleteSource = (index: number) => {
    setSources((current) =>
      current.filter((_, i) => i !== index)
    );
  };

  const filteredSources = sources.filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-intro">
        <h1>Your Knowledge Base</h1>

        <p>
          Add study materials and websites that iSmartRAG can use
          as sources.
        </p>
      </div>

      <div className="upload-grid">
        <label className="upload-card">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            onChange={addFile}
            hidden
          />

          <div className="upload-icon">↑</div>

          <h3>Upload documents</h3>

          <p>PDF, DOCX or PPT files</p>

          <span className="upload-button">
            Choose File
          </span>
        </label>

        <div className="url-card">
          <div className="upload-icon">🌐</div>

          <h3>Add a website</h3>

          <p>Use a website as a knowledge source.</p>

          <div className="url-input-row">
            <input
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              placeholder="https://example.com"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addUrl();
                }
              }}
            />

            <button onClick={addUrl}>Add</button>
          </div>
        </div>
      </div>

      <div className="sources-section">
        <div className="sources-header">
          <div>
            <h2>Sources</h2>

            <p>
              {sources.length} sources in your knowledge base
            </p>
          </div>

          <div className="search-box">
            🔍

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search sources..."
            />
          </div>
        </div>

        <div className="source-list">
          {filteredSources.length === 0 ? (
            <div className="empty-state">
              <div>📭</div>

              <h3>
                {sources.length === 0
                  ? "Your knowledge base is empty"
                  : "No sources found"}
              </h3>

              <p>
                {sources.length === 0
                  ? "Upload a document or add a website to get started."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            filteredSources.map((source, index) => (
              <div
                className="source-row"
                key={`${source.name}-${index}`}
              >
                <div
                  className={`file-type ${source.type.toLowerCase()}`}
                >
                  {source.type === "WEB"
                    ? "🌐"
                    : source.type}
                </div>

                <div className="source-info">
                  <strong>{source.name}</strong>
                  <span>{source.size}</span>
                </div>

                <span className="ready-status">
                  <i></i> Added
                </span>

                <button
                  className="delete-btn"
                  onClick={() => deleteSource(index)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Chat({
  setQuestionCount,
}: {
  setQuestionCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = (text = input) => {
    const userMessage = text.trim();

    if (!userMessage) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: userMessage,
      },
    ]);

    setQuestionCount((count) => count + 1);

    setInput("");
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="chat-page">
      <aside className="chat-history">
        <button
          className="new-chat-btn"
          onClick={newChat}
        >
          + New Chat
        </button>

        <span className="history-title">
          RECENT CHATS
        </span>

        {messages.length > 0 ? (
          <div className="chat-history-item active">
            <span>💬</span>

            <div>
              <strong>
                {messages.find((message) => message.role === "user")
                  ?.text.slice(0, 25) || "New conversation"}
              </strong>
              <small>Just now</small>
            </div>
          </div>
        ) : (
          <div className="no-chats">
            No conversations yet.
          </div>
        )}
      </aside>

      <div className="chat-main">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-logo">iS</div>

              <h2>Ask iSmartRAG</h2>

              <p>
                Ask questions about the material in your
                knowledge base.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                className={`message-row ${
                  message.role === "user"
                    ? "user-message"
                    : "ai-message"
                }`}
                key={index}
              >
                <div className="message-avatar">
                  {message.role === "ai" ? "iS" : "U"}
                </div>

                <div className="message-bubble">
                  <p>{message.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-box">
            <input
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Ask anything about your knowledge base..."
            />

            <button onClick={() => sendMessage()}>
              ↑
            </button>
          </div>

          <small>
            Connect your AI/RAG backend later to generate
            answers from your actual sources.
          </small>
        </div>
      </div>
    </div>
  );
}

function Quiz({
  quizCount,
}: {
  quizCount: number;
}) {
  return (
    <div className="page-content">
      <div className="quiz-start">
        <div className="quiz-icon-large">
          🧠
        </div>

        <span className="hero-label">
          KNOWLEDGE CHECK
        </span>

        <h1>Test your knowledge</h1>

        <p>
          Quiz questions will be generated from your
          knowledge base once the RAG system is connected.
        </p>

        <div className="quiz-options">
          <div>
            <span>Questions</span>
            <strong>0</strong>
          </div>

          <div>
            <span>Completed</span>
            <strong>{quizCount}</strong>
          </div>

          <div>
            <span>Source</span>
            <strong>Knowledge Base</strong>
          </div>
        </div>

        <button
          className="primary-btn quiz-start-btn"
          disabled
        >
          Quiz Not Ready Yet
        </button>
      </div>
    </div>
  );
}

function Settings() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("ismart-dark-mode") === "true"
  );

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;

      localStorage.setItem("ismart-dark-mode", String(next));

      document.body.classList.toggle("dark-mode", next);

      return next;
    });
  };

  return (
    <div className="page-content">
      <div className="page-intro">
        <h1>Settings</h1>
        <p>Manage your iSmartRAG preferences.</p>
      </div>

      <div className="settings-card">
        <div className="settings-section">
          <h3>Appearance</h3>

          <div className="setting-row">
            <div>
              <strong>Night Mode</strong>
              <span>
                Switch between light and dark appearance.
              </span>
            </div>

            <button
              className={`toggle ${darkMode ? "on" : ""}`}
              onClick={toggleDarkMode}
              aria-label="Toggle Night Mode"
            >
              <i></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] =
    useState<Page>("Dashboard");

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [sources, setSources] =
    useState<Source[]>([]);

  const [questionCount, setQuestionCount] =
    useState(0);

  const [quizCount] = useState(0);

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <main className="main-area">
        <Topbar
          page={page}
          onMenu={() =>
            setMobileOpen(!mobileOpen)
          }
        />

        {page === "Dashboard" && (
          <Dashboard
            setPage={setPage}
            sourceCount={sources.length}
            questionCount={questionCount}
            quizCount={quizCount}
          />
        )}

        {page === "Knowledge Base" && (
          <KnowledgeBase
            sources={sources}
            setSources={setSources}
          />
        )}

        {page === "Chat" && (
          <Chat
            setQuestionCount={setQuestionCount}
          />
        )}

        {page === "Quiz" && (
          <Quiz quizCount={quizCount} />
        )}

        {page === "Settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;