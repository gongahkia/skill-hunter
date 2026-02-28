import { apiClient } from "../lib/api-client";

export type ContractClause = {
  id: string;
  type: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
  sourceParser: string;
  parserConfidence: string;
};

export type ContractDetailResponse = {
  contract: {
    id: string;
    title: string;
    sourceType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  latestVersion: {
    id: string;
    createdAt: string;
  } | null;
  clauses: ContractClause[];
};

export async function fetchContractDetail(contractId: string) {
  return apiClient.request<ContractDetailResponse>(`/contracts/${contractId}`);
}
