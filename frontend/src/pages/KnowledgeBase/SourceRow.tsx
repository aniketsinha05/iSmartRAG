import type { Source } from "../../types";

type SourceRowProps = {
  source: Source;
  index: number;
  onDelete: (index: number) => void;
};

export default function SourceRow({
  source,
  index,
  onDelete,
}: SourceRowProps) {
  return (
    <div className="source-row" key={`${source.name}-${index}`}>
      <div className={`file-type ${source.type.toLowerCase()}`}>
        {source.type === "WEB" ? "🌐" : source.type}
      </div>

      <div className="source-info">
        <strong>{source.name}</strong>
        <span>{source.size}</span>
      </div>

      <span className="ready-status">
        <i></i> Added
      </span>

      <button
        className="delete-btn"
        onClick={() => onDelete(index)}
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}