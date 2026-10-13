import type { QuizQuestion } from "../../types";
import { ApiError } from "../../services/apiClient";

export const LETTERS = ["A", "B", "C", "D"];

export function sourceLabel(source: QuizQuestion["source"]): string {
  const parts = [source.file];
  if (source.page) parts.push(`page ${source.page}`);
  if (source.section) parts.push(source.section);
  return parts.join(" \u00B7 ");
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.detail ? err.detail : fallback;
}

export function scoreClass(score: number): string {
  if (score >= 80) return "qz-good";
  if (score >= 60) return "qz-mid";
  return "qz-bad";
}

// Same rounding as the server (Python rounds .5 to the even number),
// so the result screen and the saved attempt show the same percent.
export function percentOf(correct: number, total: number): number {
  if (total === 0) return 0;
  const x = (100 * correct) / total;
  const r = Math.round(x);
  return x % 1 === 0.5 && r % 2 === 1 ? r - 1 : r;
}