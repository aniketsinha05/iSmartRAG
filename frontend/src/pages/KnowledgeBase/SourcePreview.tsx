import type { Source } from "../../types";

type SourcePreviewProps = {
  source: Source | null;
};

export default function SourcePreview({
  source,
}: SourcePreviewProps) {
  if (!source) return null;

  return (
    <div className="source-preview">
      <strong>{source.name}</strong>
      <span>{source.size}</span>
    </div>
  );
}