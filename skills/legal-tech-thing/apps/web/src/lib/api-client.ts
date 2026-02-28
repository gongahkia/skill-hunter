import { API_BASE_URL } from "./config";
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
  type AuthTokens
} from "../auth/token-store";

export class ApiError extends Error {
  readonly status: number;

  readonly code: string;

  readonly details: unknown;

  constructor(status: number, code: string, details: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  withAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

class ApiClient {
  private refreshPromise: Promise<AuthTokens | null> | null = null;

  private async refreshTokens() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh() {
    const tokens = getStoredTokens();

    if (!tokens?.refreshToken) {
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

    const nextTokens = (await response.json()) as AuthTokens;
    setStoredTokens(nextTokens);

    return nextTokens;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      body,
      headers = {},
      withAuth = true,
      retryOnUnauthorized = true
    } = options;

    const tokens = withAuth ? getStoredTokens() : null;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "x-request-id": generateRequestId(),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(tokens?.accessToken
          ? {
              authorization: `Bearer ${tokens.accessToken}`
            }
          : {}),
        ...headers
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    if (response.status === 401 && withAuth && retryOnUnauthorized) {
      const refreshedTokens = await this.refreshTokens();

      if (refreshedTokens) {
        return this.request<T>(path, {
          ...options,
          retryOnUnauthorized: false
        });
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const code =
        typeof errorBody.error === "string"
          ? errorBody.error
          : `HTTP_${response.status}`;
      throw new ApiError(response.status, code, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
