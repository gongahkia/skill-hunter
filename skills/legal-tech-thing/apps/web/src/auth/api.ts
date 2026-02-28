import { apiClient } from "../lib/api-client";
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
  return apiClient.request("/auth/register", {
    method: "POST",
    withAuth: false,
    body: payload
  });
}

export async function loginUser(payload: LoginPayload) {
  const data = (await apiClient.request("/auth/login", {
    method: "POST",
    withAuth: false,
    body: payload
  })) as {
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

  try {
    const data = (await apiClient.request("/auth/refresh", {
      method: "POST",
      withAuth: false,
      body: {
        refreshToken: tokens.refreshToken
      }
    })) as {
      accessToken: string;
      refreshToken: string;
    };

    setStoredTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });

    return data;
  } catch {
    clearStoredTokens();
    return null;
  }
}

export async function logoutUser() {
  const tokens = getStoredTokens();

  if (!tokens) {
    clearStoredTokens();
    return;
  }

  await apiClient
    .request("/auth/logout", {
      method: "POST",
      withAuth: false,
      body: {
        refreshToken: tokens.refreshToken
      }
    })
    .catch(() => undefined);

  clearStoredTokens();
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  const body = init.body
    ? typeof init.body === "string"
      ? JSON.parse(init.body)
      : init.body
    : undefined;

  const response = await apiClient.request(path, {
    method,
    body,
    headers: (init.headers as Record<string, string>) ?? {},
    withAuth: true
  });

  setStoredAccessToken(getStoredTokens()?.accessToken ?? "");

  return response;
}
