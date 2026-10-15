const TOKEN_KEY = "mybookai-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

// Removes the token and any saved app state, so the next user starts clean
export function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter((k) => k.startsWith("mybookai"))
        .forEach((k) => store.removeItem(k));
    } catch {}
  }
}