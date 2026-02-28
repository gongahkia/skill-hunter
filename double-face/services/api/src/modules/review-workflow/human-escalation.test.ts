import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveHumanEscalationConfig,
  toConfidenceNumber
} from "./human-escalation";

describe("human escalation config", () => {
  it("defaults to disabled with baseline threshold when config is missing", () => {
    const config = resolveHumanEscalationConfig(null);

    assert.equal(config.enabled, false);
    assert.equal(config.minConfidence, 0.6);
  });

  it("uses threshold envelope medium confidence when escalation threshold is omitted", () => {
    const config = resolveHumanEscalationConfig({
      thresholds: {
        mediumMinConfidence: 0.52
      },
      humanEscalation: {
        enabled: true
      }
    });

    assert.equal(config.enabled, true);
    assert.equal(config.minConfidence, 0.52);
  });

  it("clamps configured escalation threshold into [0, 1]", () => {
    const config = resolveHumanEscalationConfig({
      humanEscalation: {
        enabled: true,
        minConfidence: 1.9
      }
    });

    assert.equal(config.minConfidence, 1);
  });
});

describe("toConfidenceNumber", () => {
  it("normalizes decimal-like values into numeric confidence", () => {
    assert.equal(toConfidenceNumber("0.45"), 0.45);
    assert.equal(toConfidenceNumber("invalid"), 0);
    assert.equal(toConfidenceNumber(-3), 0);
    assert.equal(toConfidenceNumber(3), 1);
  });
});
