import { apiClient } from "../lib/api-client";
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
