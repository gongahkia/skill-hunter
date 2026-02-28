import type { PrismaClient } from "@prisma/client";

type ClauseSearchRow = {
  clauseId: string;
  contractId: string;
  contractTitle: string;
  contractVersionId: string;
  clauseType: string;
  clauseText: string;
  startOffset: number;
  endOffset: number;
  similarityScore: number | string;
};

export type SemanticClauseMatch = {
  clauseId: string;
  contractId: string;
  contractTitle: string;
  contractVersionId: string;
  clauseType: string;
  clauseText: string;
  startOffset: number;
  endOffset: number;
  similarityScore: number;
};

function toVectorLiteral(vector: number[]) {
  const normalized = vector.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("INVALID_QUERY_EMBEDDING_VALUE");
    }

    return value;
  });

  return `[${normalized.join(",")}]`;
}

function normalizeSimilarity(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numeric));
}

export async function searchSemanticClauses(input: {
  prisma: Pick<PrismaClient, "$queryRawUnsafe">;
  ownerId: string;
  providerName: string;
  queryVector: number[];
  contractId?: string;
  limit: number;
}) {
  const vectorLiteral = toVectorLiteral(input.queryVector);

  const rows = await input.prisma.$queryRawUnsafe<ClauseSearchRow[]>(
    `
      SELECT
        c.id AS "clauseId",
        cv.contract_id AS "contractId",
        ctr.title AS "contractTitle",
        cv.id AS "contractVersionId",
        c.type::text AS "clauseType",
        c.normalized_text AS "clauseText",
        c.start_offset AS "startOffset",
        c.end_offset AS "endOffset",
        (1 - (ce.embedding <=> $1::vector)) AS "similarityScore"
      FROM clause_embeddings ce
      JOIN clauses c ON c.id = ce.clause_id
      JOIN contract_versions cv ON cv.id = c.contract_version_id
      JOIN contracts ctr ON ctr.id = cv.contract_id
      WHERE ctr.owner_id = $2::uuid
        AND ce.provider = $3
        AND ($4::uuid IS NULL OR cv.contract_id = $4::uuid)
      ORDER BY ce.embedding <=> $1::vector ASC
      LIMIT $5
    `,
    vectorLiteral,
    input.ownerId,
    input.providerName,
    input.contractId ?? null,
    input.limit
  );

  return rows.map((row) => ({
    clauseId: row.clauseId,
    contractId: row.contractId,
    contractTitle: row.contractTitle,
    contractVersionId: row.contractVersionId,
    clauseType: row.clauseType,
    clauseText: row.clauseText,
    startOffset: row.startOffset,
    endOffset: row.endOffset,
    similarityScore: normalizeSimilarity(row.similarityScore)
  })) satisfies SemanticClauseMatch[];
}
