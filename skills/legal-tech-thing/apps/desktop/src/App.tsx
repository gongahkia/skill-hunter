import { useEffect, useMemo, useState } from "react";

import { loginWithPassword, logoutWithRefreshToken } from "./auth/api";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type AuthTokens
} from "./auth/token-store";

function formatTokenPreview(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const existingTokens = getStoredAuthTokens();
    setTokens(existingTokens);
    setIsInitializing(false);
  }, []);

  const isAuthenticated = useMemo(() => tokens !== null, [tokens]);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("EMAIL_AND_PASSWORD_REQUIRED");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const response = await loginWithPassword(email.trim(), password);
      const nextTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      };

      setStoredAuthTokens(nextTokens);
      setTokens(nextTokens);
      setPassword("");
      setStatus("Desktop session authenticated against backend auth endpoints.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "LOGIN_FAILED");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    if (!tokens) {
      return;
    }

    setError(null);
    setStatus(null);
    setIsLoggingOut(true);

    try {
      await logoutWithRefreshToken(tokens.refreshToken);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "LOGOUT_FAILED");
    } finally {
      clearStoredAuthTokens();
      setTokens(null);
      setIsLoggingOut(false);
      setStatus("Cleared desktop auth session.");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Desktop Scaffold</p>
        <h1>Legal Tech Companion</h1>
        <p className="subtitle">
          Electron + React + TypeScript foundation for desktop contract review workflows.
        </p>
      </header>

      <section className="app-card">
        <h2>Bridge Status</h2>
        <p>Platform: {window.desktopBridge.platform}</p>
        <p>Electron: {window.desktopBridge.electronVersion}</p>
      </section>

      <section className="app-card auth-card">
        <h2>Desktop Auth</h2>
        {isInitializing ? <p>Loading saved session...</p> : null}
        {error ? <p className="message message-error">{error}</p> : null}
        {status ? <p className="message message-success">{status}</p> : null}

        {!isInitializing && !isAuthenticated ? (
          <div className="auth-form">
            <label className="field">
              Email
              <input
                autoComplete="email"
                disabled={isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              Password
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button disabled={isSubmitting} onClick={() => void handleLogin()} type="button">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        ) : null}

        {!isInitializing && isAuthenticated && tokens ? (
          <div className="auth-form">
            <p>Access token: {formatTokenPreview(tokens.accessToken)}</p>
            <p>Refresh token: {formatTokenPreview(tokens.refreshToken)}</p>
            <button disabled={isLoggingOut} onClick={() => void handleLogout()} type="button">
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
