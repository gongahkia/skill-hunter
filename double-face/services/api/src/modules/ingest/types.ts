export const CONTRACT_INGESTION_QUEUE = "contract-ingestion";

export type ContractIngestionJobPayload = {
  requestId: string;
  contractId: string;
  contractVersionId: string;
  ownerId: string;
  objectUri: string;
  objectKey: string;
  mimeType: string;
  contentLength: number;
  sourceType: string;
};
