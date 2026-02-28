import { API_BASE_URL } from "../lib/config";
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredAccessToken,
  setStoredTokens
} from "./token-store";

type RegisterPayload = {
  email: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? "REGISTER_FAILED");
  }

  return response.json();
}

export async function loginUser(payload: LoginPayload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? "LOGIN_FAILED");
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  setStoredTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  });

  return data;
}

export async function refreshAccessToken() {
  const tokens = getStoredTokens();

  if (!tokens) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: tokens.refreshToken
    })
  });

  if (!response.ok) {
    clearStoredTokens();
    return null;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  setStoredTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  });

  return data;
}

export async function logoutUser() {
  const tokens = getStoredTokens();

  if (!tokens) {
    clearStoredTokens();
    return;
  }

  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: tokens.refreshToken
    })
  }).catch(() => undefined);

  clearStoredTokens();
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const tokens = getStoredTokens();

  const response = await fetch(`${API_BASE_URL}${input}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(tokens?.accessToken
        ? {
            authorization: `Bearer ${tokens.accessToken}`
          }
        : {})
    }
  });

  if (response.status !== 401 || !tokens?.refreshToken) {
    return response;
  }

  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    return response;
  }

  setStoredAccessToken(refreshed.accessToken);

  return fetch(`${API_BASE_URL}${input}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${refreshed.accessToken}`
    }
  });
}
