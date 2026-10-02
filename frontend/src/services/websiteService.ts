import { apiClient } from "./apiClient";

export async function addWebsite(url: string) {
  const response = await apiClient("/add-website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  return response.json();
}