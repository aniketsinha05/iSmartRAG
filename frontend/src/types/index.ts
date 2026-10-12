export type Page =
  | "Dashboard"
  | "Knowledge Base"
  | "Chat"
  | "Quiz"
  | "Settings"
  | "Classroom";

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

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export type Classroom = {
  id: number;
  name: string;
  documentCount: number;
};