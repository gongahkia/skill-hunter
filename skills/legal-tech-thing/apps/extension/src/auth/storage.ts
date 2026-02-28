const AUTH_TOKENS_KEY = "legaltech.authTokens";

export type StoredAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function getStoredAuthTokens() {
  const response = await chrome.storage.local.get(AUTH_TOKENS_KEY);
  const tokens = response[AUTH_TOKENS_KEY] as StoredAuthTokens | undefined;

  if (!tokens?.accessToken || !tokens?.refreshToken) {
    return null;
  }

  return tokens;
}

export async function setStoredAuthTokens(tokens: StoredAuthTokens) {
  await chrome.storage.local.set({
    [AUTH_TOKENS_KEY]: tokens
  });
}

export async function clearStoredAuthTokens() {
  await chrome.storage.local.remove(AUTH_TOKENS_KEY);
}
