export const CONTRACT_INGESTION_QUEUE = "contract-ingestion";

export type ContractIngestionJobPayload = {
  contractId: string;
  contractVersionId: string;
  ownerId: string;
  objectUri: string;
  objectKey: string;
  mimeType: string;
  contentLength: number;
  sourceType: string;
};
