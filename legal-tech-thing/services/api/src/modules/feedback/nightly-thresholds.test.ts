import assert from "node:assert/strict";
import { FeedbackAction, FindingSeverity } from "@prisma/client";
import { describe, it } from "node:test";

import {
  applyThresholdEnvelope,
  parseThresholdEnvelope,
  recalibrateThresholds,
  runNightlyFeedbackAggregation
} from "./nightly-thresholds";

describe("nightly threshold recalibration", () => {
  it("parses and reapplies nested threshold envelopes", () => {
    const envelope = parseThresholdEnvelope({
      thresholds: {
        criticalMinConfidence: 0.83,
        highMinConfidence: 0.73,
        mediumMinConfidence: 0.63,
        autoEscalateSeverity: "high"
      },
      enabledAgents: {
        riskScanner: true
      }
    });

    const output = applyThresholdEnvelope(envelope, {
      criticalMinConfidence: 0.8,
      highMinConfidence: 0.7,
      mediumMinConfidence: 0.6,
      autoEscalateSeverity: "critical"
    }) as {
      thresholds: {
        criticalMinConfidence: number;
        highMinConfidence: number;
        mediumMinConfidence: number;
        autoEscalateSeverity: string;
      };
      enabledAgents: {
        riskScanner: boolean;
      };
    };

    assert.equal(output.enabledAgents.riskScanner, true);
    assert.equal(output.thresholds.autoEscalateSeverity, "critical");
    assert.equal(output.thresholds.highMinConfidence, 0.7);
  });

  it("decreases confidence thresholds when acceptance rates are high", () => {
    const recalibrated = recalibrateThresholds(
      {
        criticalMinConfidence: 0.8,
        highMinConfidence: 0.7,
        mediumMinConfidence: 0.6,
        autoEscalateSeverity: "high"
      },
      {
        critical: { accepted: 9, total: 10 },
        high: { accepted: 8, total: 10 },
        medium: { accepted: 7, total: 10 }
      }
    );

    assert.ok(recalibrated.criticalMinConfidence < 0.8);
    assert.ok(recalibrated.highMinConfidence < 0.7);
    assert.ok(recalibrated.mediumMinConfidence < 0.6);
    assert.equal(recalibrated.autoEscalateSeverity, "critical");
  });

  it("updates profiles from recent feedback aggregates", async () => {
    const updatedProfiles: Array<{ id: string; riskThresholds: unknown }> = [];

    const prisma = {
      policyProfile: {
        async findMany() {
          return [
            {
              id: "profile-1",
              userId: "user-1",
              riskThresholds: {
                thresholds: {
                  criticalMinConfidence: 0.8,
                  highMinConfidence: 0.7,
                  mediumMinConfidence: 0.6,
                  autoEscalateSeverity: "high"
                }
              }
            }
          ];
        },
        async update(args: { where: { id: string }; data: { riskThresholds: unknown } }) {
          updatedProfiles.push({
            id: args.where.id,
            riskThresholds: args.data.riskThresholds
          });
          return {};
        }
      },
      reviewFeedback: {
        async findMany() {
          return [
            {
              action: FeedbackAction.ACCEPTED,
              correctedSeverity: FindingSeverity.CRITICAL,
              finding: {
                severity: FindingSeverity.HIGH,
                contractVersion: {
                  contract: {
                    ownerId: "user-1"
                  }
                }
              }
            },
            {
              action: FeedbackAction.ACCEPTED,
              correctedSeverity: FindingSeverity.CRITICAL,
              finding: {
                severity: FindingSeverity.CRITICAL,
                contractVersion: {
                  contract: {
                    ownerId: "user-1"
                  }
                }
              }
            },
            {
              action: FeedbackAction.ACCEPTED,
              correctedSeverity: FindingSeverity.CRITICAL,
              finding: {
                severity: FindingSeverity.CRITICAL,
                contractVersion: {
                  contract: {
                    ownerId: "user-1"
                  }
                }
              }
            }
          ];
        }
      }
    };

    const result = await runNightlyFeedbackAggregation(prisma);

    assert.equal(result.profilesScanned, 1);
    assert.equal(result.profilesUpdated, 1);
    assert.equal(updatedProfiles.length, 1);
  });
});
