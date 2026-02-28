import { FeedbackAction, FindingSeverity } from "@prisma/client";

type Thresholds = {
  criticalMinConfidence: number;
  highMinConfidence: number;
  mediumMinConfidence: number;
  autoEscalateSeverity: "critical" | "high" | "medium" | "low" | "info";
};

type ThresholdEnvelope = {
  mode: "flat" | "nested";
  base: Record<string, unknown>;
  thresholds: Thresholds;
};

type FeedbackAggregationPrisma = {
  policyProfile: {
    findMany: (...args: any[]) => Promise<any[]>;
    update: (...args: any[]) => Promise<unknown>;
  };
  reviewFeedback: {
    findMany: (...args: any[]) => Promise<any[]>;
  };
};

const defaultThresholds: Thresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundConfidence(value: number) {
  return Math.round(value * 1000) / 1000;
}

function toSeverityKey(
  severity: FindingSeverity
): "critical" | "high" | "medium" | "low" | "info" {
  if (severity === FindingSeverity.CRITICAL) {
    return "critical";
  }

  if (severity === FindingSeverity.HIGH) {
    return "high";
  }

  if (severity === FindingSeverity.MEDIUM) {
    return "medium";
  }

  if (severity === FindingSeverity.LOW) {
    return "low";
  }

  return "info";
}

export function parseThresholdEnvelope(riskThresholds: unknown): ThresholdEnvelope {
  const payload =
    riskThresholds && typeof riskThresholds === "object"
      ? (riskThresholds as Record<string, unknown>)
      : {};

  if (payload.thresholds && typeof payload.thresholds === "object") {
    const nested = payload.thresholds as Record<string, unknown>;

    return {
      mode: "nested",
      base: payload,
      thresholds: {
        criticalMinConfidence:
          typeof nested.criticalMinConfidence === "number"
            ? nested.criticalMinConfidence
            : defaultThresholds.criticalMinConfidence,
        highMinConfidence:
          typeof nested.highMinConfidence === "number"
            ? nested.highMinConfidence
            : defaultThresholds.highMinConfidence,
        mediumMinConfidence:
          typeof nested.mediumMinConfidence === "number"
            ? nested.mediumMinConfidence
            : defaultThresholds.mediumMinConfidence,
        autoEscalateSeverity:
          nested.autoEscalateSeverity === "critical" ||
          nested.autoEscalateSeverity === "high" ||
          nested.autoEscalateSeverity === "medium" ||
          nested.autoEscalateSeverity === "low" ||
          nested.autoEscalateSeverity === "info"
            ? nested.autoEscalateSeverity
            : defaultThresholds.autoEscalateSeverity
      }
    };
  }

  return {
    mode: "flat",
    base: payload,
    thresholds: {
      criticalMinConfidence:
        typeof payload.criticalMinConfidence === "number"
          ? payload.criticalMinConfidence
          : defaultThresholds.criticalMinConfidence,
      highMinConfidence:
        typeof payload.highMinConfidence === "number"
          ? payload.highMinConfidence
          : defaultThresholds.highMinConfidence,
      mediumMinConfidence:
        typeof payload.mediumMinConfidence === "number"
          ? payload.mediumMinConfidence
          : defaultThresholds.mediumMinConfidence,
      autoEscalateSeverity:
        payload.autoEscalateSeverity === "critical" ||
        payload.autoEscalateSeverity === "high" ||
        payload.autoEscalateSeverity === "medium" ||
        payload.autoEscalateSeverity === "low" ||
        payload.autoEscalateSeverity === "info"
          ? payload.autoEscalateSeverity
          : defaultThresholds.autoEscalateSeverity
    }
  };
}

export function applyThresholdEnvelope(envelope: ThresholdEnvelope, thresholds: Thresholds) {
  if (envelope.mode === "nested") {
    return {
      ...envelope.base,
      thresholds
    };
  }

  return {
    ...envelope.base,
    ...thresholds
  };
}

type SeverityStats = {
  accepted: number;
  total: number;
};

export function recalibrateThresholds(current: Thresholds, severityStats: {
  critical: SeverityStats;
  high: SeverityStats;
  medium: SeverityStats;
}) {
  const computeAdjustedThreshold = (
    baseValue: number,
    stats: SeverityStats,
    floor: number,
    ceiling: number
  ) => {
    if (stats.total === 0) {
      return baseValue;
    }

    const acceptanceRate = stats.accepted / stats.total;
    const adjustment = clamp((0.5 - acceptanceRate) * 0.24, -0.12, 0.12);
    return roundConfidence(clamp(baseValue + adjustment, floor, ceiling));
  };

  const nextThresholds: Thresholds = {
    criticalMinConfidence: computeAdjustedThreshold(
      current.criticalMinConfidence,
      severityStats.critical,
      0.5,
      0.95
    ),
    highMinConfidence: computeAdjustedThreshold(current.highMinConfidence, severityStats.high, 0.45, 0.9),
    mediumMinConfidence: computeAdjustedThreshold(
      current.mediumMinConfidence,
      severityStats.medium,
      0.35,
      0.85
    ),
    autoEscalateSeverity: current.autoEscalateSeverity
  };

  const candidateSeverities: Array<{ severity: "critical" | "high" | "medium"; stats: SeverityStats }> = [
    { severity: "critical", stats: severityStats.critical },
    { severity: "high", stats: severityStats.high },
    { severity: "medium", stats: severityStats.medium }
  ];

  const ranked = candidateSeverities
    .filter((entry) => entry.stats.total >= 3)
    .map((entry) => ({
      severity: entry.severity,
      acceptance: entry.stats.accepted / entry.stats.total
    }))
    .sort((left, right) => right.acceptance - left.acceptance);

  if (ranked.length > 0 && ranked[0]) {
    nextThresholds.autoEscalateSeverity = ranked[0].severity;
  }

  return nextThresholds;
}

export async function runNightlyFeedbackAggregation(prisma: FeedbackAggregationPrisma) {
  const lookbackDays = Number(process.env.FEEDBACK_AGGREGATION_LOOKBACK_DAYS ?? 90);
  const lookbackStart = new Date(Date.now() - Math.max(1, lookbackDays) * 24 * 60 * 60 * 1000);

  const [profiles, feedbackEntries] = await Promise.all([
    prisma.policyProfile.findMany({
      select: {
        id: true,
        userId: true,
        riskThresholds: true
      }
    }),
    prisma.reviewFeedback.findMany({
      where: {
        createdAt: {
          gte: lookbackStart
        }
      },
      select: {
        action: true,
        correctedSeverity: true,
        finding: {
          select: {
            severity: true,
            contractVersion: {
              select: {
                contract: {
                  select: {
                    ownerId: true
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  const userStats = new Map<
    string,
    {
      critical: SeverityStats;
      high: SeverityStats;
      medium: SeverityStats;
    }
  >();

  for (const entry of feedbackEntries) {
    const ownerId = entry.finding.contractVersion.contract.ownerId;
    const severity = toSeverityKey(entry.correctedSeverity ?? entry.finding.severity);

    if (severity !== "critical" && severity !== "high" && severity !== "medium") {
      continue;
    }

    const stats =
      userStats.get(ownerId) ??
      {
        critical: { accepted: 0, total: 0 },
        high: { accepted: 0, total: 0 },
        medium: { accepted: 0, total: 0 }
      };

    stats[severity].total += 1;
    if (entry.action === FeedbackAction.ACCEPTED) {
      stats[severity].accepted += 1;
    }

    userStats.set(ownerId, stats);
  }

  let updatedProfiles = 0;

  for (const profile of profiles) {
    const stats = userStats.get(profile.userId);
    if (!stats) {
      continue;
    }

    const envelope = parseThresholdEnvelope(profile.riskThresholds);
    const nextThresholds = recalibrateThresholds(envelope.thresholds, stats);

    const isUnchanged =
      envelope.thresholds.criticalMinConfidence === nextThresholds.criticalMinConfidence &&
      envelope.thresholds.highMinConfidence === nextThresholds.highMinConfidence &&
      envelope.thresholds.mediumMinConfidence === nextThresholds.mediumMinConfidence &&
      envelope.thresholds.autoEscalateSeverity === nextThresholds.autoEscalateSeverity;

    if (isUnchanged) {
      continue;
    }

    await prisma.policyProfile.update({
      where: {
        id: profile.id
      },
      data: {
        riskThresholds: applyThresholdEnvelope(envelope, nextThresholds)
      }
    });

    updatedProfiles += 1;
  }

  return {
    profilesScanned: profiles.length,
    profilesUpdated: updatedProfiles,
    lookbackDays: Math.max(1, lookbackDays)
  };
}
