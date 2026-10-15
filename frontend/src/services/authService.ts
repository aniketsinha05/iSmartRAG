import { API_BASE_URL } from "../config/env";
import { ApiError } from "./apiClient";
import { clearSession, setToken } from "./tokenStore";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

async function post(path: string, body: object): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg)
        detail = data.detail[0].msg;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export async function register(name: string, email: string, password: string) {
  const data = await post("/auth/register", { name, email, password });
  setToken(data.access_token);
  return data.user;
}

export async function login(email: string, password: string) {
  const data = await post("/auth/login", { email, password });
  setToken(data.access_token);
  return data.user;
}

export function logout() {
  clearSession();
}