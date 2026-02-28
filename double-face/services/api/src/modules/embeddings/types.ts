export const CLAUSE_EMBEDDINGS_QUEUE = "clause-embeddings";

export type ClauseEmbeddingJobPayload = {
  requestId: string;
  contractVersionId: string;
};

export type EmbeddingProvider = {
  name: string;
  embedTexts: (texts: string[]) => Promise<number[][]>;
};
