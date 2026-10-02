import { apiClient } from "./apiClient";

export async function searchDocuments(query: string) {
  const response = await apiClient("/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  return response.json();
}