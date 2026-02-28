import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adjudicateFindings, type SourcedFinding } from "./adjudication";

function makeFinding(input: Partial<SourcedFinding> & Pick<SourcedFinding, "sourceAgent">): SourcedFinding {
  return {
    type: "risky-language",
    title: "Finding",
    description: "Description",
    severity: "medium",
    confidence: 0.5,
    suggestedRedline: null,
    evidence: [
      {
        clauseId: "11111111-1111-1111-1111-111111111111",
        startOffset: 0,
        endOffset: 10,
        excerpt: "text"
      }
    ],
    ...input
  };
}

describe("adjudicateFindings", () => {
  it("merges overlapping findings and deduplicates identical evidence spans", () => {
    const overlapA = makeFinding({
      sourceAgent: "risk-scanner",
      severity: "medium",
      confidence: 0.62,
      title: "Liability cap is unclear",
      evidence: [
        {
          clauseId: "11111111-1111-1111-1111-111111111111",
          startOffset: 10,
          endOffset: 80,
          excerpt: "liability language"
        }
      ]
    });

    const overlapB = makeFinding({
      sourceAgent: "compliance",
      severity: "high",
      confidence: 0.91,
      title: "Liability cap is unclear and non-compliant",
      description: "Longer description should win during merge.",
      evidence: [
        {
          clauseId: "11111111-1111-1111-1111-111111111111",
          startOffset: 20,
          endOffset: 90,
          excerpt: "cap exposure"
        },
        {
          clauseId: "11111111-1111-1111-1111-111111111111",
          startOffset: 10,
          endOffset: 80,
          excerpt: "liability language"
        }
      ]
    });

    const adjudicated = adjudicateFindings([overlapA, overlapB]);

    assert.equal(adjudicated.length, 1);
    assert.equal(adjudicated[0]?.severity, "high");
    assert.equal(adjudicated[0]?.confidence, 0.91);
    assert.equal(adjudicated[0]?.evidence.length, 2);
    assert.deepEqual(new Set(adjudicated[0]?.sourceAgents), new Set(["risk-scanner", "compliance"]));
  });

  it("does not merge overlapping offsets when clause IDs differ", () => {
    const findingA = makeFinding({
      sourceAgent: "risk-scanner",
      evidence: [
        {
          clauseId: "11111111-1111-1111-1111-111111111111",
          startOffset: 100,
          endOffset: 180,
          excerpt: "clause one"
        }
      ]
    });

    const findingB = makeFinding({
      sourceAgent: "ambiguity",
      evidence: [
        {
          clauseId: "22222222-2222-2222-2222-222222222222",
          startOffset: 120,
          endOffset: 170,
          excerpt: "clause two"
        }
      ]
    });

    const adjudicated = adjudicateFindings([findingA, findingB]);

    assert.equal(adjudicated.length, 2);
  });

  it("does not merge findings when evidence overlap ratio is below threshold", () => {
    const findingA = makeFinding({
      sourceAgent: "risk-scanner",
      evidence: [
        {
          clauseId: "33333333-3333-3333-3333-333333333333",
          startOffset: 0,
          endOffset: 100,
          excerpt: "first evidence"
        }
      ]
    });

    const findingB = makeFinding({
      sourceAgent: "compliance",
      evidence: [
        {
          clauseId: "33333333-3333-3333-3333-333333333333",
          startOffset: 95,
          endOffset: 120,
          excerpt: "second evidence"
        }
      ]
    });

    const adjudicated = adjudicateFindings([findingA, findingB]);

    assert.equal(adjudicated.length, 2);
  });
});
