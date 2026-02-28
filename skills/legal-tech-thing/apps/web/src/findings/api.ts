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

export async function fetchContractFindings(contractId: string) {
  const response = (await apiClient.request(
    `/contracts/${contractId}/findings?limit=200`
  )) as {
    items: ContractFinding[];
  };

  return response.items;
}
