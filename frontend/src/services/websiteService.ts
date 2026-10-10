import { apiClient } from "./apiClient";

export async function addWebsite(url: string) {
  const response = await apiClient(
    `/website?url=${encodeURIComponent(url)}`,
    { method: "POST" }
  );

  return response.json();
}