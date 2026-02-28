import { apiClient } from "../lib/api-client";

export type DashboardContract = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastReviewAt: string | null;
};

export async function fetchDashboardContracts() {
  const response = (await apiClient.request("/contracts")) as {
    items: DashboardContract[];
  };

  return response.items;
}
