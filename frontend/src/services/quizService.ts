import { apiClient } from "./apiClient";
import type {
  QuizAttempt,
  QuizAttemptSummary,
  QuizDifficulty,
  QuizQuestion,
  QuizSettings,
} from "../types";

type ApiQuestion = {
  id: string;
  type: "mcq" | "tf";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  source: { file: string; page?: number | null; section?: string | null };
};

type ApiSummary = {
  id: string;
  classroom_id: number;
  classroom_name: string;
  created_at: string;
  num_questions: number;
  correct: number;
  score: number;
};

type ApiAttempt = ApiSummary & {
  settings: {
    document_names: string[];
    difficulty: QuizDifficulty;
    include_true_false: boolean;
  };
  questions: ApiQuestion[];
  answers: (number | null)[];
};

function toQuestion(q: ApiQuestion): QuizQuestion {
  return {
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    answerIndex: q.answer_index,
    explanation: q.explanation,
    source: {
      file: q.source.file,
      page: q.source.page ?? null,
      section: q.source.section ?? null,
    },
  };
}

function toApiQuestion(q: QuizQuestion): ApiQuestion {
  return {
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    answer_index: q.answerIndex,
    explanation: q.explanation,
    source: q.source,
  };
}

function toSummary(a: ApiSummary): QuizAttemptSummary {
  return {
    id: a.id,
    classroomId: a.classroom_id,
    classroomName: a.classroom_name,
    createdAt: a.created_at,
    numQuestions: a.num_questions,
    correct: a.correct,
    score: a.score,
  };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function generateQuiz(s: QuizSettings): Promise<QuizQuestion[]> {
  const response = await apiClient(`/classrooms/${s.classroomId}/quiz`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      document_names: s.documentNames,
      num_questions: s.numQuestions,
      difficulty: s.difficulty,
      include_true_false: s.includeTrueFalse,
    }),
  });
  const data = await response.json();
  return (data.questions as ApiQuestion[]).map(toQuestion);
}

export async function saveQuizAttempt(
  s: QuizSettings,
  questions: QuizQuestion[],
  answers: (number | null)[]
): Promise<QuizAttemptSummary> {
  const response = await apiClient("/quiz/attempts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      classroom_id: s.classroomId,
      document_names: s.documentNames,
      difficulty: s.difficulty,
      include_true_false: s.includeTrueFalse,
      questions: questions.map(toApiQuestion),
      answers,
    }),
  });
  return toSummary(await response.json());
}

export async function fetchQuizAttempts(limit = 50): Promise<QuizAttemptSummary[]> {
  const response = await apiClient(`/quiz/attempts?limit=${limit}`);
  const data = await response.json();
  return (data.attempts as ApiSummary[]).map(toSummary);
}

export async function fetchQuizAttempt(id: string): Promise<QuizAttempt> {
  const response = await apiClient(`/quiz/attempts/${encodeURIComponent(id)}`);
  const a = (await response.json()) as ApiAttempt;
  return {
    ...toSummary(a),
    settings: {
      documentNames: a.settings.document_names,
      difficulty: a.settings.difficulty,
      includeTrueFalse: a.settings.include_true_false,
    },
    questions: a.questions.map(toQuestion),
    answers: a.answers,
  };
}