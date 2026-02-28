import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateSuggestedRedline } from "./generator";
import { getClauseLibrarySnippet } from "./clause-library";

describe("clause-library retrieval", () => {
  it("returns type/severity snippet for English", () => {
    const snippet = getClauseLibrarySnippet({
      findingType: "compliance",
      severityBucket: "medium",
      language: "en"
    });

    assert.equal(
      snippet,
      "Align clause text with policy pattern requirements and jurisdiction controls."
    );
  });

  it("resolves fallback-safe clause in Spanish locale variants", () => {
    const snippet = getClauseLibrarySnippet({
      findingType: "fallback-safe",
      severityBucket: "any",
      language: "es-MX"
    });

    assert.match(snippet ?? "", /Ninguna de las partes/i);
  });

  it("falls back to English snippets for unsupported locales", () => {
    const snippet = getClauseLibrarySnippet({
      findingType: "ambiguity",
      severityBucket: "low",
      language: "fr"
    });

    assert.equal(
      snippet,
      "Clarify phrasing and align term definitions with the definitions section."
    );
  });
});

describe("redline generator with clause library", () => {
  it("injects language-specific safe clause for high-severity findings", () => {
    const finding = {
      type: "risky-language",
      title: "test",
      description: "test",
      severity: "critical",
      confidence: 0.5,
      suggestedRedline: null,
      evidence: [
        {
          clauseId: null,
          startOffset: 0,
          endOffset: 1,
          excerpt: "x"
        }
      ],
      sourceAgents: ["risk-scanner"],
      severityScore: 120
    } as Parameters<typeof generateSuggestedRedline>[0];

    const redline = generateSuggestedRedline(finding, "es");
    assert.match(redline, /Ninguna de las partes/i);
  });
});
