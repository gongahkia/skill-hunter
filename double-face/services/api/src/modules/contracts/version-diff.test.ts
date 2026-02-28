import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diffContractVersions, type ClauseSnapshot } from "./version-diff";

function clause(input: Partial<ClauseSnapshot> & Pick<ClauseSnapshot, "id" | "normalizedText">): ClauseSnapshot {
  return {
    id: input.id,
    type: input.type ?? "UNKNOWN",
    normalizedText: input.normalizedText,
    startOffset: input.startOffset ?? 0,
    endOffset: input.endOffset ?? input.normalizedText.length
  };
}

describe("diffContractVersions", () => {
  it("maps unchanged, modified, added, and removed clauses", () => {
    const fromClauses: ClauseSnapshot[] = [
      clause({ id: "old-1", type: "PAYMENT", normalizedText: "Payment is due in 30 days." }),
      clause({ id: "old-2", type: "LIABILITY", normalizedText: "Liability is capped at fees paid." }),
      clause({ id: "old-3", type: "TERM", normalizedText: "Initial term is 12 months." })
    ];

    const toClauses: ClauseSnapshot[] = [
      clause({ id: "new-1", type: "PAYMENT", normalizedText: "Payment is due in 30 days." }),
      clause({
        id: "new-2",
        type: "LIABILITY",
        normalizedText: "Liability is capped at fees paid in prior 12 months."
      }),
      clause({ id: "new-3", type: "CONFIDENTIALITY", normalizedText: "Confidentiality survives for 3 years." })
    ];

    const result = diffContractVersions(fromClauses, toClauses);

    assert.equal(result.summary.unchanged, 1);
    assert.equal(result.summary.modified, 1);
    assert.equal(result.summary.added, 1);
    assert.equal(result.summary.removed, 1);
  });

  it("treats unrelated clauses as added/removed rather than modified", () => {
    const fromClauses: ClauseSnapshot[] = [
      clause({ id: "old-1", type: "PAYMENT", normalizedText: "Payment in USD only." })
    ];

    const toClauses: ClauseSnapshot[] = [
      clause({ id: "new-1", type: "TERMINATION", normalizedText: "Either party may terminate for convenience." })
    ];

    const result = diffContractVersions(fromClauses, toClauses);

    assert.equal(result.summary.modified, 0);
    assert.equal(result.summary.added, 1);
    assert.equal(result.summary.removed, 1);
  });
});
