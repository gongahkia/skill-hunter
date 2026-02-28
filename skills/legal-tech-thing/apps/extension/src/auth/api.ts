import { API_BASE_URL } from "../config";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenTtl: string;
};

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function parseErrorCode(response: Response) {
  const fallbackCode = `HTTP_${response.status}`;
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  return typeof payload?.error === "string" ? payload.error : fallbackCode;
}

export async function loginWithPassword(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "x-request-id": generateRequestId(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorCode(response));
  }

  return (await response.json()) as LoginResponse;
}

export async function logoutWithRefreshToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "x-request-id": generateRequestId(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorCode(response));
  }
}
