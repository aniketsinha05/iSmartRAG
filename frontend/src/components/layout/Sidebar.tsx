import type { Page } from "../../types";
import { menuItems } from "../../constants/navigation";

const DISPLAY_NAME: Record<string, string> = {
  Dashboard: "Home",
  Chat: "Search / Ask",
};

export default function Sidebar({
  page,
  setPage,
  collapsed,
  setCollapsed,
}: {
  page: Page;
  setPage: (page: Page) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  return (
    <>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">iS</div>

          <div className="sidebar-brand-text">
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
                if (window.innerWidth <= 900) setCollapsed(true);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {DISPLAY_NAME[item.label] ?? item.label}
            </button>
          ))}
        </nav>
      </aside>

      {!collapsed && (
        <button
          className="sidebar-backdrop"
          onClick={() => setCollapsed(true)}
          aria-label="Close sidebar"
        />
      )}
    </>
  );
}