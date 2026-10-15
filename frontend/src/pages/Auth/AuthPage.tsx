import { useState } from "react";
import type { FormEvent } from "react";
import { login, register } from "../../services/authService";
import { ApiError } from "../../services/apiClient";
import vioraLogo from "../../assets/viora glowing logo.png";
import "./AuthPage.css";

export default function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError && err.detail ? err.detail : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-brand">
        <img src={vioraLogo} alt="VIORA logo" />
        <h2>VIORA</h2>
        <p>Your AI study assistant. Upload your notes, chat with citations, and quiz yourself.</p>
      </aside>

      <main className="auth-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <img className="auth-mobile-logo" src={vioraLogo} alt="VIORA logo" />
          <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-sub">
            {isLogin ? "Log in to continue studying." : "Sign up to start your own study space."}
          </p>

          {!isLogin && (
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isLogin ? undefined : 8}
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Log in" : "Sign up"}
          </button>

          <p className="auth-switch">
            {isLogin ? "No account yet? " : "Already registered? "}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(""); }}>
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}