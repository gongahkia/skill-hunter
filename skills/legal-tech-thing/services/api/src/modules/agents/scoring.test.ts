import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AdjudicatedFinding } from "./adjudication";
import { scoreFinding, scoreFindings } from "./scoring";

function buildFinding(type: AdjudicatedFinding["type"]): AdjudicatedFinding {
  return {
    type,
    title: `${type} title`,
    description: `${type} description`,
    severity: "medium",
    confidence: 0.7,
    suggestedRedline: null,
    evidence: [
      {
        clauseId: "11111111-1111-1111-1111-111111111111",
        startOffset: 0,
        endOffset: 32,
        excerpt: "may terminate at any time"
      }
    ],
    sourceAgents: ["risk-scanner"]
  };
}

describe("adaptive finding scoring", () => {
  it("adds type-specific adaptive boost when scoring individual findings", () => {
    const finding = buildFinding("risky-language");

    const baseline = scoreFinding(finding, []);
    const boosted = scoreFinding(finding, [], {
      "risky-language": 8
    });

    assert.equal(boosted, baseline + 8);
  });

  it("reorders findings when adaptive boosts favor one finding type", () => {
    const risky = buildFinding("risky-language");
    const compliance = buildFinding("compliance");

    const ranked = scoreFindings([risky, compliance], [], {
      compliance: 6
    });

    assert.equal(ranked[0]?.type, "compliance");
    assert.equal(ranked[1]?.type, "risky-language");
  });
});
