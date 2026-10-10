import { apiClient } from "./apiClient";
import type { Source } from "../types";

type ApiSource = {
  name: string;
  type: string;
  chunks: number;
  added_at: string | null;
  size_bytes: number | null;
};

function toSourceType(apiType: string, name: string): Source["type"] {
  const t = apiType.toLowerCase();

  if (t === "website" || t === "web") return "WEB";
  if (t === "word" || t === "docx") return "DOCX";
  if (t === "ppt" || t === "pptx") return "PPT";
  if (t === "excel") return "EXCEL";
  if (t === "pdf") return "PDF";

  return name.startsWith("http") ? "WEB" : "PDF";
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function fetchSources(): Promise<Source[]> {
  const response = await apiClient("/sources");
  const data = await response.json();

  return (data.sources as ApiSource[]).map((item) => ({
    name: item.name,
    type: toSourceType(item.type, item.name),
    size: formatSize(item.size_bytes),
    chunks: item.chunks,
    addedAt: item.added_at,
    sizeBytes: item.size_bytes,
  }));
}

export async function fetchSourceContent(name: string): Promise<string[]> {
  const response = await apiClient(
    `/sources/content?name=${encodeURIComponent(name)}&limit=20`
  );
  const data = await response.json();

  return data.chunks as string[];
}

export async function deleteSourceByName(name: string) {
  await apiClient(`/sources?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}