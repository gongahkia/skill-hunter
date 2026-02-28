import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchSemanticClauses } from "./semantic-clause-search";

describe("searchSemanticClauses", () => {
  it("queries clause embeddings and normalizes search results", async () => {
    const queryCalls: unknown[][] = [];
    const prisma = {
      async $queryRawUnsafe(...args: unknown[]) {
        queryCalls.push(args);
        return [
          {
            clauseId: "clause-1",
            contractId: "contract-1",
            contractTitle: "Master Services Agreement",
            contractVersionId: "version-1",
            clauseType: "LIABILITY",
            clauseText: "liability is capped at fees paid",
            startOffset: 120,
            endOffset: 180,
            similarityScore: "0.83"
          },
          {
            clauseId: "clause-2",
            contractId: "contract-2",
            contractTitle: "Order Form",
            contractVersionId: "version-2",
            clauseType: "TERM",
            clauseText: "initial term is 12 months",
            startOffset: 12,
            endOffset: 36,
            similarityScore: 1.4
          }
        ];
      }
    };

    const results = await searchSemanticClauses({
      prisma: prisma as never,
      ownerId: "f4a2c5ce-3fd2-4cb0-b9dd-f00a7a7a9f95",
      providerName: "mock",
      queryVector: [0.1, 0.2, 0.3],
      limit: 10
    });

    assert.equal(results.length, 2);
    assert.equal(results[0]?.similarityScore, 0.83);
    assert.equal(results[1]?.similarityScore, 1);
    assert.equal(queryCalls.length, 1);
    assert.match(String(queryCalls[0]?.[0] ?? ""), /clause_embeddings/i);
    assert.equal(queryCalls[0]?.[1], "[0.1,0.2,0.3]");
  });

  it("rejects invalid query vectors", async () => {
    const prisma = {
      async $queryRawUnsafe() {
        return [];
      }
    };

    await assert.rejects(
      () =>
        searchSemanticClauses({
          prisma: prisma as never,
          ownerId: "f4a2c5ce-3fd2-4cb0-b9dd-f00a7a7a9f95",
          providerName: "mock",
          queryVector: [0.2, Number.NaN],
          limit: 5
        }),
      /INVALID_QUERY_EMBEDDING_VALUE/
    );
  });
});
