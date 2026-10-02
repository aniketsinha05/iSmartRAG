import { useState } from "react";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("ismart-dark-mode") === "true"
  );

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;

      localStorage.setItem(
        "ismart-dark-mode",
        String(next)
      );

      document.body.classList.toggle("dark-mode", next);

      return next;
    });
  };

  return (
    <div className="page-content">
      <div className="page-intro">
        <h1>Settings</h1>
        <p>Manage your iSmartRAG preferences.</p>
      </div>

      <div className="settings-card">
        <div className="settings-section">
          <h3>Appearance</h3>

          <div className="setting-row">
            <div>
              <strong>Night Mode</strong>
              <span>
                Switch between light and dark appearance.
              </span>
            </div>

            <button
              className={`toggle ${darkMode ? "on" : ""}`}
              onClick={toggleDarkMode}
              aria-label="Toggle Night Mode"
            >
              <i></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}