import { readFileSync, writeFileSync } from "node:fs";

const FILES = ["src/App.css", "src/theme.css", "src/pages/Auth/AuthPage.css"];

const MAP = {
  // brand blues -> Viora blue-violet
  "#2563eb": "#6558df", "#1d4ed8": "#5448c8", "#3b82f6": "#8070ff",
  "#60a5fa": "#7098ff", "#93c5fd": "#b7aeff", "#38bdf8": "#477bff",
  "#1d3a8a": "#4b3fb8", "#3b5bb5": "#5448c8", "#3b6fe0": "#6558df",
  "#9db4e8": "#a99ff0", "#9db8f0": "#b7aeff",
  // light tints
  "#eaf1ff": "#ecebff", "#eef4ff": "#f1f0ff", "#e9efff": "#ecebff",
  "#f3f7ff": "#f4f3ff", "#f6f9ff": "#f7f6ff", "#f5f8ff": "#f4f3ff",
  "#f1f5fd": "#f1f0ff", "#f7f9fd": "#f6f5ff", "#f9fbff": "#f8f8ff",
  "#fafcff": "#f9f9ff", "#dbe8ff": "#ddd9ff", "#e0ebff": "#e2dfff",
  "#dbe5fb": "#dcd8f7", "#cdd9f5": "#d3cef5", "#c5d3f0": "#cfc9f0",
  "#b9ccf5": "#c9c2f5", "#eef2fa": "#f1f0fa",
  // light neutrals
  "#f4f6fb": "#f7f7ff", "#f6f8fc": "#f7f7ff", "#e5e7eb": "#e4e1f5",
  "#e3e8f0": "#e4e1f5", "#e8ecf3": "#e4e1f5", "#d5dbe7": "#d9d5ee",
  "#d1d5db": "#d3cfe8", "#dbe2ee": "#dad6ee", "#f0f1f3": "#eeebf8",
  "#eef0f4": "#eeebf8", "#f3f4f6": "#f1f0fa", "#f9fafb": "#f8f8fd",
  "#f1f5f9": "#f1f0fa", "#f8fafc": "#f8f8fd",
  // text
  "#111827": "#29234b", "#1f2937": "#29234b", "#374151": "#3d3860",
  "#4b5563": "#5e5b80", "#6b7280": "#77728f", "#8a94a6": "#8a86a3",
  "#9aa3b2": "#9a96b3", "#6b7a99": "#77728f", "#212121": "#29234b",
  // dark theme
  "#111111": "#090a18", "#171717": "#111225", "#181818": "#111225",
  "#1c1c1c": "#191832", "#202020": "#191832", "#242424": "#1f1e3c",
  "#1a1a1a": "#0f1020", "#2a2a2a": "#302d50", "#333333": "#302d50",
  "#f5f5f5": "#f4f0ff", "#9a9a9a": "#a7a2c5", "#bdbdbd": "#a7a2c5",
  "#d4d4d4": "#d9d5f0",
  // dark tints, sidebar, auth
  "#1c2a47": "#232150", "#1b2538": "#1e1d3f", "#1c2433": "#1b1a36",
  "#242b3a": "#232246", "#16213a": "#181738", "#1a2540": "#1e1b45",
  "#2b3a5c": "#3a3670", "#0b1226": "#0c0d1f", "#0b1d45": "#1a1647",
  "#0a1633": "#10112b", "#0f1f4d": "#29215b", "#0b1020": "#090a18",
  "#111936": "#111225",
};

const RGBA = [["37, 99, 235", "101, 88, 223"], ["10, 22, 51", "9, 10, 24"]];

for (const file of FILES) {
  let css = readFileSync(file, "utf8");
  css = css.replace(/#[0-9a-f]{6}\b/gi, (m) => MAP[m.toLowerCase()] ?? m);
  for (const [a, b] of RGBA) css = css.split(`rgba(${a},`).join(`rgba(${b},`);
  writeFileSync(file, css);
  console.log("updated", file);
}