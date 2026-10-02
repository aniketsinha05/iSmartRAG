import { API_BASE_URL } from "../config/env";

export async function apiClient(
  endpoint: string,
  options?: RequestInit
) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
}