export type Page =
  | "Dashboard"
  | "Knowledge Base"
  | "Chat"
  | "Quiz"
  | "Settings";

export type Source = {
  name: string;
  type: "PDF" | "DOCX" | "PPT" | "WEB";
  size: string;
};

export type Message = {
  role: "user" | "ai";
  text: string;
};