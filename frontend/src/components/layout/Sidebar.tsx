import type { Page } from "../../types";
import { menuItems } from "../../constants/navigation";

// Names shown in the menu (the page names inside the app do not change)
const DISPLAY_NAME: Record<string, string> = {
  Dashboard: "Home",
  Chat: "Search / Ask",
};

export default function Sidebar({
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
  return (
    <>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">iS</div>

          <div className="sidebar-brand-text">
            <strong>iSmartRAG</strong>
            <span>Learning Assistant</span>
          </div>

          <button
            className="sidebar-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
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
              {DISPLAY_NAME[item.label] ?? item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item logout"
            onClick={() => setPage("Dashboard")}
          >
            <span className="nav-icon">↪</span>
            Home
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="sidebar-reopen"
          onClick={() => setMobileOpen(false)}
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}
    </>
  );
}