// Local dev (npm run dev): backend on port 8000.
// Docker / production: same domain, Caddy passes /api to the backend.
// You can override with VITE_API_BASE_URL.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");