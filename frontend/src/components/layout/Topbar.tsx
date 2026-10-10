import { useEffect, useState } from "react";
import type { Page } from "../../types";

const API_BASE = "http://127.0.0.1:8000";

export default function Topbar({
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
        const response = await fetch(`${API_BASE}/health`);

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
      <button
        className="mobile-menu"
        onClick={onMenu}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <div className="topbar-right">
        <span
          className={`system-pill ${
            online === null ? "" : online ? "ok" : "bad"
          }`}
        >
          <i></i>
          {online === null
            ? "Checking..."
            : online
            ? "System Online"
            : "System Offline"}
        </span>

        <button className="topbar-bell" aria-label="Notifications">
          🔔
        </button>

        <div className="topbar-user">
          <span className="topbar-avatar">U</span>
          <span className="topbar-name">User</span>
          <span className="topbar-caret">⌄</span>
        </div>
      </div>
    </header>
  );
}