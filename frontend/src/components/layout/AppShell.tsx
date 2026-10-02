import type { ReactNode } from "react";
import type { Page } from "../../types";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  page,
  setPage,
  mobileOpen,
  setMobileOpen,
  children,
}: {
  page: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <main className="main-content">
        <Topbar
          page={page}
          onMenu={() => setMobileOpen(!mobileOpen)}
        />
        {children}
      </main>
    </div>
  );
}