import { useEffect, useState } from "react";
import App from "./App";
import AuthPage from "./pages/Auth/AuthPage";
import { getToken } from "./services/tokenStore";
import { logout } from "./services/authService";

export default function AuthGate() {
  const [token, setTokenState] = useState<string | null>(getToken);

  // apiClient fires this event when the server answers 401
  useEffect(() => {
    const onLogout = () => setTokenState(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  if (!token) {
    return <AuthPage onAuthenticated={() => setTokenState(getToken())} />;
  }

  return (
    <>
      <button className="logout-btn" onClick={() => { logout(); setTokenState(null); }}>
        Logout
      </button>
      {/* key={token}: a new login remounts the app, so no old user's data lingers */}
      <App key={token} />
    </>
  );
}