import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiClient(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // the error response had no JSON body
    }
    throw new ApiError(response.status, detail);
  }

  return response;
}