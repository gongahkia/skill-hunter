import { useEffect, useMemo, useState } from "react";

import { loginWithPassword, logoutWithRefreshToken } from "../auth/api";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type StoredAuthTokens
} from "../auth/storage";

function formatTokenPreview(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

export function SidePanelApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokens, setTokens] = useState<StoredAuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const existingTokens = await getStoredAuthTokens();
        setTokens(existingTokens);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "AUTH_INIT_FAILED");
      } finally {
        setIsInitializing(false);
      }
    }

    void loadStoredSession();
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
      await setStoredAuthTokens(nextTokens);
      setTokens(nextTokens);
      setPassword("");
      setStatus("Authenticated and stored tokens in chrome.storage.local.");
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
      await clearStoredAuthTokens();
      setTokens(null);
      setStatus("Cleared auth tokens from chrome.storage.local.");
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="panel">
      <header>
        <h1>Legal Tech Companion</h1>
        <p>Sign in with API credentials for extension workflows.</p>
      </header>

      {isInitializing ? <p>Loading local auth session...</p> : null}
      {error ? <p className="message message-error">{error}</p> : null}
      {status ? <p className="message message-success">{status}</p> : null}

      {!isInitializing && !isAuthenticated ? (
        <section className="panel-section">
          <h2>Login</h2>
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
        </section>
      ) : null}

      {!isInitializing && isAuthenticated && tokens ? (
        <section className="panel-section">
          <h2>Session Active</h2>
          <p>Access token: {formatTokenPreview(tokens.accessToken)}</p>
          <p>Refresh token: {formatTokenPreview(tokens.refreshToken)}</p>
          <button disabled={isLoggingOut} onClick={() => void handleLogout()} type="button">
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
