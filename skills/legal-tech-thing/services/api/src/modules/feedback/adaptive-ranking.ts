import { FeedbackAction } from "@prisma/client";

import type { AgentRuntimeOutput } from "../agents/runtime";

export type FindingType = AgentRuntimeOutput["findings"][number]["type"];
export type AdaptiveTypeBoosts = Partial<Record<FindingType, number>>;

type FeedbackPrismaClient = {
  reviewFeedback: {
    findMany: (args: {
      where: {
        finding: {
          contractVersion: {
            contract: {
              ownerId: string;
            };
          };
        };
      };
      select: {
        action: true;
        finding: {
          select: {
            title: true;
            description: true;
          };
        };
      };
    }) => Promise<
      Array<{
        action: FeedbackAction;
        finding: {
          title: string;
          description: string;
        };
      }>
    >;
  };
};

const MIN_FEEDBACK_SAMPLES = Number(process.env.ADAPTIVE_RANKING_MIN_SAMPLES ?? 3);
const MAX_ACCEPTANCE_BOOST = Number(process.env.ADAPTIVE_RANKING_MAX_BOOST ?? 12);
const SATURATION_SAMPLE_SIZE = Number(process.env.ADAPTIVE_RANKING_SATURATION_SAMPLES ?? 20);

function inferFindingTypeFromText(title: string, description: string): FindingType {
  const normalized = `${title} ${description}`.toLowerCase();

  if (normalized.includes("missing") || normalized.includes("absent")) {
    return "missing-clause";
  }

  if (normalized.includes("ambigu")) {
    return "ambiguity";
  }

  if (normalized.includes("compliance") || normalized.includes("non-compliant")) {
    return "compliance";
  }

  if (
    normalized.includes("conflict") ||
    normalized.includes("inconsisten") ||
    normalized.includes("contradict")
  ) {
    return "cross-clause-conflict";
  }

  return "risky-language";
}

export async function buildAdaptiveFindingTypeBoosts(
  prisma: FeedbackPrismaClient,
  userId: string
): Promise<AdaptiveTypeBoosts> {
  const feedbackEntries = await prisma.reviewFeedback.findMany({
    where: {
      finding: {
        contractVersion: {
          contract: {
            ownerId: userId
          }
        }
      }
    },
    select: {
      action: true,
      finding: {
        select: {
          title: true,
          description: true
        }
      }
    }
  });

  const aggregates = new Map<FindingType, { accepted: number; total: number }>();

  for (const entry of feedbackEntries) {
    const type = inferFindingTypeFromText(entry.finding.title, entry.finding.description);
    const current = aggregates.get(type) ?? {
      accepted: 0,
      total: 0
    };

    current.total += 1;
    if (entry.action === FeedbackAction.ACCEPTED) {
      current.accepted += 1;
    }

    aggregates.set(type, current);
  }

  const boosts: AdaptiveTypeBoosts = {};

  for (const [type, aggregate] of aggregates.entries()) {
    if (aggregate.total < MIN_FEEDBACK_SAMPLES) {
      continue;
    }

    const acceptanceRatio = aggregate.accepted / aggregate.total;
    if (acceptanceRatio <= 0.5) {
      continue;
    }

    const ratioStrength = (acceptanceRatio - 0.5) / 0.5;
    const sampleStrength = Math.min(1, aggregate.total / Math.max(1, SATURATION_SAMPLE_SIZE));
    const rawBoost = MAX_ACCEPTANCE_BOOST * ratioStrength * sampleStrength;

    boosts[type] = Math.round(rawBoost * 100) / 100;
  }

  return boosts;
}
