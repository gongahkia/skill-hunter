import { PrismaClient } from "@prisma/client";

import { getEmbeddingProvider } from "./provider";

const prisma = new PrismaClient();

export type ClauseEmbeddingResult = {
  clauseId: string;
  vector: number[];
};

export async function generateClauseEmbeddings(contractVersionId: string) {
  const clauses = await prisma.clause.findMany({
    where: {
      contractVersionId
    },
    orderBy: {
      startOffset: "asc"
    },
    select: {
      id: true,
      normalizedText: true
    }
  });

  if (clauses.length === 0) {
    return {
      providerName: "none",
      embeddings: [] as ClauseEmbeddingResult[]
    };
  }

  const provider = getEmbeddingProvider();
  const vectors = await provider.embedTexts(
    clauses.map((clause) => clause.normalizedText)
  );

  if (vectors.length !== clauses.length) {
    throw new Error("EMBEDDING_VECTOR_COUNT_MISMATCH");
  }

  return {
    providerName: provider.name,
    embeddings: clauses.map((clause, index) => ({
      clauseId: clause.id,
      vector: vectors[index] ?? []
    }))
  };
}

export async function closeEmbeddingsGeneratorResources() {
  await prisma.$disconnect();
}
