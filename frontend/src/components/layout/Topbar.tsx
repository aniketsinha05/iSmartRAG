import type { Page } from "../../types";

export default function Topbar({
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