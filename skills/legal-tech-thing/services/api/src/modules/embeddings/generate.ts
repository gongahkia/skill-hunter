import { PrismaClient } from "@prisma/client";

import { getEmbeddingProvider } from "./provider";

const prisma = new PrismaClient();

export type ClauseEmbeddingResult = {
  clauseId: string;
  vector: number[];
};

function toVectorLiteral(vector: number[]) {
  const normalized = vector.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("INVALID_EMBEDDING_VALUE");
    }

    return value;
  });

  return `[${normalized.join(",")}]`;
}

async function upsertClauseEmbedding(
  providerName: string,
  embedding: ClauseEmbeddingResult
) {
  const vectorLiteral = toVectorLiteral(embedding.vector);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO clause_embeddings (
        clause_id,
        provider,
        dimensions,
        embedding,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4::vector, now(), now())
      ON CONFLICT (clause_id) DO UPDATE
      SET
        provider = EXCLUDED.provider,
        dimensions = EXCLUDED.dimensions,
        embedding = EXCLUDED.embedding,
        updated_at = now()
    `,
    embedding.clauseId,
    providerName,
    embedding.vector.length,
    vectorLiteral
  );
}

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

  const embeddings = clauses.map((clause, index) => ({
    clauseId: clause.id,
    vector: vectors[index] ?? []
  }));

  for (const embedding of embeddings) {
    await upsertClauseEmbedding(provider.name, embedding);
  }

  return {
    providerName: provider.name,
    embeddings
  };
}

export async function closeEmbeddingsGeneratorResources() {
  await prisma.$disconnect();
}
