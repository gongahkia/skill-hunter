import type { LlmProvider } from "@prisma/client";

export const REVIEW_RUN_QUEUE = "review-runs";

export type ReviewRunJobPayload = {
  requestId: string;
  reviewRunId: string;
  contractVersionId: string;
  profileId: string;
  provider: LlmProvider;
  selectedAgents: string[];
};
