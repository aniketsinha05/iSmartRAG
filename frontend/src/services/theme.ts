export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "ismart-settings";

export function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const theme = JSON.parse(saved).theme;
      if (theme === "light" || theme === "dark" || theme === "system") return theme;
    }
    if (localStorage.getItem("ismart-dark-mode") === "true") return "dark";
  } catch {
    // storage unavailable
  }
  return "light";
}

export function applyTheme(choice: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = choice === "dark" || (choice === "system" && systemDark);
  document.body.classList.toggle("dark-mode", isDark);
  try {
    localStorage.setItem("ismart-dark-mode", String(isDark));
  } catch {
    // storage unavailable
  }
}

export function saveTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: choice }));
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event("viora:theme"));
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (loadTheme() === "system") applyTheme("system");
  });