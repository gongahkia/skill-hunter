import { apiClient } from "../lib/api-client";

export type ContractFinding = {
  id: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  confidence: string;
  status: "OPEN" | "ACCEPTED" | "DISMISSED" | "NEEDS_EDIT";
  evidenceSpan: {
    id: string;
    startOffset: number;
    endOffset: number;
    excerpt: string;
    pageNumber: number | null;
  };
};

export type FindingStatus = "open" | "accepted" | "dismissed" | "needs-edit";
export type FeedbackAction = "accepted" | "dismissed" | "edited";
export type FeedbackSeverity = "critical" | "high" | "medium" | "low" | "info";

export async function fetchContractFindings(contractId: string) {
  const response = (await apiClient.request(
    `/contracts/${contractId}/findings?limit=200`
  )) as {
    items: ContractFinding[];
  };

  return response.items;
}

export async function updateFindingStatus(findingId: string, status: FindingStatus) {
  const response = (await apiClient.request(`/findings/${findingId}`, {
    method: "PATCH",
    body: {
      status
    }
  })) as {
    finding: ContractFinding;
  };

  return response.finding;
}

type CreateFindingFeedbackInput = {
  action?: FeedbackAction;
  rationale: string;
  correctedSeverity?: FeedbackSeverity;
  correctedTitle?: string;
};

export async function createFindingFeedback(
  findingId: string,
  input: CreateFindingFeedbackInput
) {
  const response = (await apiClient.request(`/findings/${findingId}/feedback`, {
    method: "POST",
    body: {
      action: input.action,
      rationale: input.rationale,
      correctedSeverity: input.correctedSeverity,
      correctedTitle: input.correctedTitle
    }
  })) as {
    finding: ContractFinding;
  };

  return response.finding;
}
