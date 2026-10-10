import { useEffect, useState } from "react";
import type { Page } from "../../types";
import { API_BASE_URL } from "../../config/env";

const TITLES: Record<Page, string> = {
  Dashboard: "Home",
  "Knowledge Base": "Knowledge Base",
  Chat: "Search / Ask",
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

        <div className="topbar-user">
          <span className="topbar-avatar">U</span>
          <span className="topbar-name">User</span>
          <span className="topbar-caret">&#8964;</span>
        </div>
      </div>
    </header>
  );
}