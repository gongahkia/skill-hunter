import { apiClient } from "../lib/api-client";
import { getStoredTokens } from "../auth/token-store";
import { API_BASE_URL } from "../lib/config";
import type { PolicyProvider } from "../policy/api";

export type ReviewRunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type ReviewRunSummary = {
  id: string;
  contractVersionId: string;
  profileId: string;
  provider: PolicyProvider;
  providerModel: string;
  status: ReviewRunStatus;
  createdAt: string;
};

export type ReviewRunProgress = {
  id: string;
  status: ReviewRunStatus;
  progressPercent: number;
  provider: PolicyProvider;
  providerModel: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

type ReviewRunDetailResponse = {
  reviewRun: ReviewRunSummary & {
    orchestrationMeta: Record<string, unknown>;
    startedAt: string | null;
    finishedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    updatedAt: string;
    progressPercent: number;
    providerMetadata: {
      provider: PolicyProvider;
      model: string;
    };
  };
};

type CreateReviewRunResponse = {
  reviewRun: ReviewRunSummary;
  queued: boolean;
  queueJobId: string;
};

type CreateReviewRunInput = {
  contractVersionId: string;
  profileId?: string;
  provider?: PolicyProvider;
  selectedAgents?: string[];
};

export async function createReviewRun(input: CreateReviewRunInput) {
  return apiClient.request<CreateReviewRunResponse>("/reviews", {
    method: "POST",
    body: input
  });
}

export async function fetchReviewRun(reviewRunId: string) {
  return apiClient.request<ReviewRunDetailResponse>(`/reviews/${reviewRunId}`);
}

type SubscribeReviewRunInput = {
  reviewRunId: string;
  onProgress: (event: ReviewRunProgress) => void;
  onError: (message: string) => void;
};

function parseSseChunk(buffer: string) {
  const separator = "\n\n";
  const index = buffer.lastIndexOf(separator);

  if (index === -1) {
    return {
      events: [] as string[],
      remainder: buffer
    };
  }

  const rawEvents = buffer.slice(0, index).split(separator);
  return {
    events: rawEvents,
    remainder: buffer.slice(index + separator.length)
  };
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  return {
    eventName,
    data: dataLines.join("\n")
  };
}

export function subscribeToReviewRunEvents({
  reviewRunId,
  onProgress,
  onError
}: SubscribeReviewRunInput) {
  const tokens = getStoredTokens();

  if (!tokens?.accessToken) {
    onError("UNAUTHORIZED");
    return () => undefined;
  }

  const controller = new AbortController();

  const streamEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${reviewRunId}/events`, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          authorization: `Bearer ${tokens.accessToken}`
        },
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        onError(`SSE_SUBSCRIBE_FAILED_${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        const { events, remainder } = parseSseChunk(buffer);
        buffer = remainder;

        for (const eventText of events) {
          const parsedEvent = parseSseEvent(eventText);

          if (!parsedEvent.data) {
            continue;
          }

          if (parsedEvent.eventName === "error") {
            onError(parsedEvent.data);
            continue;
          }

          if (parsedEvent.eventName === "review-progress") {
            const payload = JSON.parse(parsedEvent.data) as ReviewRunProgress;
            onProgress(payload);
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        onError(error instanceof Error ? error.message : "SSE_SUBSCRIBE_FAILED");
      }
    }
  };

  void streamEvents();

  return () => {
    controller.abort();
  };
}
