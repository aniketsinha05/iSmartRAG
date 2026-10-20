import { useEffect, useRef, useState } from "react";
import type { Page } from "../../types";
import { API_BASE_URL } from "../../config/env";
import { apiClient } from "../../services/apiClient";
import { logout } from "../../services/authService";
import { applyTheme, loadTheme, saveTheme } from "../../services/theme";
import type { ThemeChoice } from "../../services/theme";
import Icon from "../common/Icon";
import type { IconName } from "../common/Icon";

const TITLES: Record<Page, string> = {
  Dashboard: "Home",
  "Knowledge Base": "Knowledge Base",
  Chat: "Chatbot",
  Classroom: "Classroom",
  Quiz: "Quiz",
  Settings: "Settings",
};

const THEMES: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Auto", icon: "monitor" },
];

export default function Topbar({
  page,
  onMenu,
}: {
  page: Page;
  onMenu: () => void;
}) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState({ name: "", email: "" });
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient("/auth/me")
      .then((r) => r.json())
      .then((u) => setUser({ name: u.name ?? "", email: u.email ?? "" }))
      .catch(() => {});
  }, []);

  // keep in sync if the theme is changed on the Settings page
  useEffect(() => {
    const sync = () => setTheme(loadTheme());
    window.addEventListener("viora:theme", sync);
    return () => window.removeEventListener("viora:theme", sync);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    saveTheme(choice);
    applyTheme(choice);
  };

  const initial = (user.name.trim().charAt(0) || "U").toUpperCase();

  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu} aria-label="Toggle sidebar">
        <Icon name="menu" size={20} />
      </button>

      <div className="topbar-title">
        <h2>{TITLES[page]}</h2>

        {page === "Chat" && (
          <span className="tt-wrap">
            <button type="button" className="tt-btn" aria-label="How the chatbot finds answers">
              <Icon name="info" size={16} />
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
                <li>Chats are saved in the Recent list, whatever the scope.</li>
              </ul>
            </div>
          </span>
        )}
      </div>

      <div className="topbar-right">
        <span className={`system-pill ${online === null ? "" : online ? "ok" : "bad"}`}>
          <i></i>
          {online === null ? "Checking..." : online ? "System Online" : "System Offline"}
        </span>

        <button className="topbar-bell" aria-label="Notifications">
          <Icon name="bell" size={19} />
        </button>

        <div className="user-menu" ref={menuRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="topbar-avatar">{initial}</span>
            <span className="topbar-name">{user.name || "User"}</span>
            <Icon name="chevron" size={16} className={`topbar-caret ${menuOpen ? "open" : ""}`} />
          </button>

          {menuOpen && (
            <div className="ud" role="menu">
              <div className="ud-head">
                <span className="ud-avatar">{initial}</span>
                <div>
                  <strong>{user.name || "User"}</strong>
                  <small>{user.email}</small>
                </div>
              </div>

              <div className="ud-sep" />

              <button
                type="button"
                role="menuitem"
                className="ud-item"
                onClick={() => {
                  setMenuOpen(false);
                  window.location.hash = "/settings";
                }}
              >
                <Icon name="user" size={17} />
                Account settings
              </button>

              <button
                type="button"
                role="menuitem"
                className="ud-item"
                onClick={() => {
                  setMenuOpen(false);
                  window.location.hash = "/knowledge-base";
                }}
              >
                <Icon name="database" size={17} />
                Knowledge Base
              </button>

              <div className="ud-label">Appearance</div>
              <div className="ud-theme" role="group" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={theme === t.value ? "active" : ""}
                    onClick={() => chooseTheme(t.value)}
                  >
                    <Icon name={t.icon} size={15} />
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="ud-sep" />

              <button
                type="button"
                role="menuitem"
                className="ud-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  window.dispatchEvent(new Event("auth:logout"));
                }}
              >
                <Icon name="logout" size={17} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}