import type { Page } from "../../types";

export default function Topbar({
  page,
}: {
  page: Page;
}) {
  return (
    <header className="topbar">
      <div>
        <h2>{page}</h2>
        <p>Welcome to iSmartRAG</p>
      </div>
    </header>
  );
}