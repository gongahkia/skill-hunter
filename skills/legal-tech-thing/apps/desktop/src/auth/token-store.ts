const TOKEN_STORAGE_KEY = "legaltech.desktop.authTokens";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export function getStoredAuthTokens() {
  const rawValue = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as AuthTokens;
    if (!parsed?.accessToken || !parsed?.refreshToken) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

export function setStoredAuthTokens(tokens: AuthTokens) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredAuthTokens() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}
