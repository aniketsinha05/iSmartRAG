import { useEffect, useState } from "react";
import type { Page } from "../../types";
import { API_BASE_URL } from "../../config/env";

const TITLES: Record<Page, string> = {
  Dashboard: "Home",
  "Knowledge Base": "Knowledge Base",
  Chat: "Chatbot",
  Classroom: "Classroom",
  Quiz: "Quiz",
  Settings: "Settings",
};

export default function Topbar({
  page,
  onMenu,
}: {
  page: Page;
  onMenu: () => void;
}) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!cancelled) setOnline(response.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    check();
    const timer = window.setInterval(check, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu} aria-label="Toggle sidebar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      <div className="topbar-title">
        <h2>{TITLES[page]}</h2>

        {page === "Chat" && (
          <span className="tt-wrap">
            <button type="button" className="tt-btn" aria-label="How the chatbot finds answers">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            </button>

            <div className="tt-pop" role="tooltip">
              <strong>How the chatbot finds answers</strong>
              <ul>
                <li>
                  <b>No classroom selected:</b> it searches your entire
                  Knowledge Base, including documents that are not in any
                  classroom.
                </li>
                <li>
                  <b>Classroom selected</b> (use the + button): it searches
                  only that classroom's documents. You can pick several, and
                  a shared document is used once.
                </li>
                <li>
                  Each answer is built from the 5 most relevant chunks, so
                  with many documents a narrower scope gives better answers.
                </li>
                <li>
                  It answers only from your documents. If the answer isn't
                  there, it says so.
                </li>
                <li>
                  Chats are saved in the Recent list, whatever the scope.
                </li>
              </ul>
            </div>
          </span>
        )}
      </div>

      <div className="topbar-right">
        <span
          className={`system-pill ${online === null ? "" : online ? "ok" : "bad"}`}
        >
          <i></i>
          {online === null
            ? "Checking..."
            : online
            ? "System Online"
            : "System Offline"}
        </span>

        <button className="topbar-bell" aria-label="Notifications">
          &#128276;
        </button>

        <button
          type="button"
          className="topbar-user"
          onClick={() => {
            window.location.hash = "/settings";
          }}
          aria-label="Open settings"
          title="Settings"
        >
          <span className="topbar-avatar">U</span>
          <span className="topbar-name">User</span>
        </button>
      </div>
    </header>
  );
}