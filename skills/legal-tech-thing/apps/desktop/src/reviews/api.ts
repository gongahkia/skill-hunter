import { API_BASE_URL } from "../config";

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function parseErrorCode(response: Response) {
  const fallbackCode = `HTTP_${response.status}`;
  const payload = (await response.json().catch(() => null)) as
    | { error?: string | { code?: string } }
    | null;

  if (typeof payload?.error === "string") {
    return payload.error;
  }
  if (typeof payload?.error?.code === "string") {
    return payload.error.code;
  }

  return fallbackCode;
}

export type ReviewExportArtifactResponse = {
  fileName: string;
  artifact: Record<string, unknown>;
};

export async function fetchReviewExportArtifact(
  reviewRunId: string,
  accessToken: string
): Promise<ReviewExportArtifactResponse> {
  const response = await fetch(`${API_BASE_URL}/reviews/${reviewRunId}/export`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-request-id": generateRequestId()
    }
  });

  if (!response.ok) {
    throw new Error(await parseErrorCode(response));
  }

  return response.json() as Promise<ReviewExportArtifactResponse>;
}
