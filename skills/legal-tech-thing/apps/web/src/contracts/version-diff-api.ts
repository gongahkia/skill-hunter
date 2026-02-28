import { apiClient } from "../lib/api-client";

export type ContractVersionDiffResponse = {
  contractId: string;
  fromVersion: {
    id: string;
    createdAt: string;
  };
  toVersion: {
    id: string;
    createdAt: string;
  };
  diff: {
    summary: {
      unchanged: number;
      modified: number;
      added: number;
      removed: number;
    };
    changes: Array<{
      changeType: "unchanged" | "modified" | "added" | "removed";
      similarity: number;
      fromClause: {
        id: string;
        type: string;
        normalizedText: string;
        startOffset: number;
        endOffset: number;
      } | null;
      toClause: {
        id: string;
        type: string;
        normalizedText: string;
        startOffset: number;
        endOffset: number;
      } | null;
    }>;
  };
};

export async function fetchContractVersionDiff(contractId: string) {
  return apiClient.request<ContractVersionDiffResponse>(`/contracts/${contractId}/versions/diff`);
}
