export type Page =
  | "Dashboard"
  | "Knowledge Base"
  | "Chat"
  | "Quiz"
  | "Settings";

export type Source = {
  name: string;
  type: "PDF" | "DOCX" | "PPT" | "EXCEL" | "WEB";
  size: string;
  chunks?: number;
  addedAt?: string | null;
  sizeBytes?: number | null;
};

export type Message = {
  role: "user" | "ai";
  text: string;
};

export type SearchResult = {
  text: string;
  source: string | null;
  type: string | null;
  distance: number | null;
};