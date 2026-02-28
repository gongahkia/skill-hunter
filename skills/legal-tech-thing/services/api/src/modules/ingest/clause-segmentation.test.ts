import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentContractClauses } from "./clause-segmentation";

describe("segmentContractClauses", () => {
  it("segments numbered legal text into separate clauses", () => {
    const source = [
      "1. Definitions",
      '"Affiliate" means any entity controlling a party.',
      "2. Term",
      "This Agreement starts on the Effective Date."
    ].join("\n\n");

    const clauses = segmentContractClauses(source);

    assert.equal(clauses.length, 2);
    assert.equal(clauses[0]?.heading, "1. Definitions");
    assert.match(clauses[0]?.text ?? "", /Affiliate/);
    assert.equal(clauses[1]?.heading, "2. Term");
    assert.match(clauses[1]?.text ?? "", /Effective Date/);

    for (const clause of clauses) {
      assert.equal(source.slice(clause.startOffset, clause.endOffset), clause.text);
    }
  });

  it("retains unnumbered legal text as a single clause when no heading markers exist", () => {
    const source = [
      "This Agreement is entered into by and between the parties.",
      "The parties agree to cooperate in good faith and exchange required notices promptly."
    ].join("\n\n");

    const clauses = segmentContractClauses(source);

    assert.equal(clauses.length, 1);
    assert.equal(clauses[0]?.heading, "This Agreement is entered into by and between the parties.");
    assert.equal(clauses[0]?.text, source);
    assert.equal(clauses[0]?.startOffset, 0);
    assert.equal(clauses[0]?.endOffset, source.length);
  });

  it("returns no clauses for blank input", () => {
    assert.deepEqual(segmentContractClauses("  \n\n   \n"), []);
  });
});
