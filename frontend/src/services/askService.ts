import { apiClient } from "./apiClient";

export async function askQuestion(
  question: string,
  nResults = 3,
  chatId?: string,
) {
  const params = new URLSearchParams({
    question,
    n_results: String(nResults),
  });

  if (chatId) params.set("chat_id", chatId);

  const response = await apiClient(`/ask?${params.toString()}`);
  return response.json();
}
