import { apiClient } from "./apiClient";

export async function checkHealth() {
  const response = await apiClient("/");
  return response.json();
}