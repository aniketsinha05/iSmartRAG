import type { Page } from "../../types";
import { menuItems } from "../../constants/navigation";
import vioraLogo from "../../assets/viora glowing logo.png";
import Icon from "../common/Icon";

const DISPLAY_NAME: Record<string, string> = {
  Dashboard: "Home",
  Chat: "Chatbot",
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
          <img
            src={vioraLogo}
            alt="Viora logo"
            style={{ width: 52, height: 52, objectFit: "contain", background: "transparent" }}
          />
          <div className="sidebar-brand-text">
            <strong>VIORA</strong>
            <span>A little beyond ordinary</span>
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
              <span className="nav-icon">
                <Icon name={item.icon} size={18} />
              </span>
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