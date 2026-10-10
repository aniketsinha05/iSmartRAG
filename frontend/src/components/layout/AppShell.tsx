import type { ReactNode } from "react";
import type { Page } from "../../types";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  page,
  setPage,
  collapsed,
  setCollapsed,
  children,
}: {
  page: Page;
  setPage: (page: Page) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <main className="main-content">
        <Topbar page={page} onMenu={() => setCollapsed(!collapsed)} />
        {children}
      </main>
    </div>
  );
}