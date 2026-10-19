export type Page =
  | "Dashboard"
  | "Knowledge Base"
  | "Chat"
  | "Quiz"
  | "Settings"
  | "Classroom";

export type Source = {
  id: number;
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

export type QuizDifficulty = "easy" | "medium" | "hard";

export type QuizQuestion = {
  id: string;
  type: "mcq" | "tf";
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  source: { file: string; page: number | null; section: string | null };
};

export type QuizSettings = {
  classroomId: number;
  documentIds: number[];
  numQuestions: 5 | 10;
  difficulty: QuizDifficulty;
  includeTrueFalse: boolean;
};

export type QuizAttemptSummary = {
  id: string;
  classroomId: number | null;
  classroomName: string;
  createdAt: string;
  numQuestions: number;
  correct: number;
  score: number; // percent
};

export type QuizAttempt = QuizAttemptSummary & {
  settings: {
    documentNames: string[];
    difficulty: QuizDifficulty;
    includeTrueFalse: boolean;
  };
  questions: QuizQuestion[];
  answers: (number | null)[]; // null = skipped
};