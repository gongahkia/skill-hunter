export const CLAUSE_EMBEDDINGS_QUEUE = "clause-embeddings";

export type ClauseEmbeddingJobPayload = {
  contractVersionId: string;
};

export type EmbeddingProvider = {
  name: string;
  embedTexts: (texts: string[]) => Promise<number[][]>;
};
