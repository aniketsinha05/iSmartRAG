import { apiClient } from "./apiClient";

export async function askQuestion(question: string, nResults = 3) {
  const params = new URLSearchParams({
    question,
    n_results: String(nResults),
  });

  const response = await apiClient(`/ask?${params.toString()}`);

  return response.json();
}