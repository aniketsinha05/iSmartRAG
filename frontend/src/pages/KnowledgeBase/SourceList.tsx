import type { Source } from "../../types";
import SourceRow from "./SourceRow";

type SourceListProps = {
  sources: Source[];
  filteredSources: Source[];
  onDelete: (index: number) => void;
};

export default function SourceList({
  sources,
  filteredSources,
  onDelete,
}: SourceListProps) {
  if (filteredSources.length === 0) {
    return (
      <div className="source-list">
        <div className="empty-state">
          <div>📭</div>

          <h3>
            {sources.length === 0
              ? "Your knowledge base is empty"
              : "No sources found"}
          </h3>

          <p>
            {sources.length === 0
              ? "Upload a PDF or add a website to get started."
              : "Try a different search."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="source-list">
      {filteredSources.map((source, index) => (
        <SourceRow
          key={`${source.name}-${index}`}
          source={source}
          index={index}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}