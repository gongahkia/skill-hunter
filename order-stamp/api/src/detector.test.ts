import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectAdversarialClauses } from "./detector.js";

describe("order-stamp detector", () => {
  it("flags arbitration and class-action waiver language", () => {
    const report = detectAdversarialClauses(
      "By using this service you agree to binding arbitration and a class action waiver.",
      10
    );

    assert.equal(report.findings.length > 0, true);
    assert.equal(report.verdict !== "safe", true);
  });

  it("stays safe for neutral text", () => {
    const report = detectAdversarialClauses("This agreement confirms delivery of office chairs.", 10);
    assert.equal(report.findings.length, 0);
    assert.equal(report.verdict, "safe");
  });
});
