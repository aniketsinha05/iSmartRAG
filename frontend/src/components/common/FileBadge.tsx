export default function FileBadge({ type }: { type: string | null }) {
  const t = (type ?? "").toLowerCase();
  let label = "FILE";
  if (t === "pdf") label = "PDF";
  else if (t === "word" || t === "docx") label = "DOC";
  else if (t === "ppt" || t === "pptx") label = "PPT";
  else if (t === "excel" || t === "xlsx" || t === "csv") label = "XLS";
  else if (t === "website" || t === "web") label = "WEB";

  return <span className={`file-badge fb-${label.toLowerCase()}`}>{label}</span>;
}