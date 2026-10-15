import { API_BASE_URL } from "../config/env";
import { getToken, clearSession } from "./tokenStore";

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
  const headers = new Headers(options?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  if (response.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new Event("auth:logout"));
  }

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