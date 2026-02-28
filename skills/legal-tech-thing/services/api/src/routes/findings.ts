import { FeedbackAction, FindingSeverity, FindingStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const findingIdParamsSchema = z.object({
  id: z.string().uuid()
});

const updateFindingBodySchema = z.object({
  status: z.enum(["open", "accepted", "dismissed", "needs-edit"])
});

const createFeedbackBodySchema = z.object({
  action: z.enum(["accepted", "dismissed", "edited"]).optional(),
  rationale: z.string().min(1),
  correctedSeverity: z
    .enum(["critical", "high", "medium", "low", "info"])
    .optional(),
  correctedTitle: z.string().min(1).max(255).optional()
});

function toFindingStatus(status: z.infer<typeof updateFindingBodySchema>["status"]) {
  if (status === "open") {
    return FindingStatus.OPEN;
  }

  if (status === "accepted") {
    return FindingStatus.ACCEPTED;
  }

  if (status === "dismissed") {
    return FindingStatus.DISMISSED;
  }

  return FindingStatus.NEEDS_EDIT;
}

function toFeedbackAction(action: "accepted" | "dismissed" | "edited") {
  if (action === "accepted") {
    return FeedbackAction.ACCEPTED;
  }

  if (action === "dismissed") {
    return FeedbackAction.DISMISSED;
  }

  return FeedbackAction.EDITED;
}

function toFindingSeverity(value: "critical" | "high" | "medium" | "low" | "info") {
  if (value === "critical") {
    return FindingSeverity.CRITICAL;
  }

  if (value === "high") {
    return FindingSeverity.HIGH;
  }

  if (value === "medium") {
    return FindingSeverity.MEDIUM;
  }

  if (value === "low") {
    return FindingSeverity.LOW;
  }

  return FindingSeverity.INFO;
}

const findingRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/:id", async (request, reply) => {
    const paramsResult = findingIdParamsSchema.safeParse(request.params);
    const bodyResult = updateFindingBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: {
          params: paramsResult.success ? null : paramsResult.error.flatten(),
          body: bodyResult.success ? null : bodyResult.error.flatten()
        }
      });
    }

    const finding = await app.prisma.finding.findFirst({
      where: {
        id: paramsResult.data.id,
        contractVersion: {
          contract: {
            ownerId: request.auth.userId
          }
        }
      },
      select: {
        id: true
      }
    });

    if (!finding) {
      return reply.status(404).send({
        error: "FINDING_NOT_FOUND"
      });
    }

    const updatedFinding = await app.prisma.finding.update({
      where: {
        id: finding.id
      },
      data: {
        status: toFindingStatus(bodyResult.data.status)
      },
      include: {
        evidenceSpan: {
          select: {
            id: true,
            startOffset: true,
            endOffset: true,
            excerpt: true,
            pageNumber: true
          }
        }
      }
    });

    return reply.status(200).send({
      finding: updatedFinding
    });
  });

  app.post("/:id/feedback", async (request, reply) => {
    const paramsResult = findingIdParamsSchema.safeParse(request.params);
    const bodyResult = createFeedbackBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: {
          params: paramsResult.success ? null : paramsResult.error.flatten(),
          body: bodyResult.success ? null : bodyResult.error.flatten()
        }
      });
    }

    const finding = await app.prisma.finding.findFirst({
      where: {
        id: paramsResult.data.id,
        contractVersion: {
          contract: {
            ownerId: request.auth.userId
          }
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!finding) {
      return reply.status(404).send({
        error: "FINDING_NOT_FOUND"
      });
    }

    const inferredAction: "accepted" | "dismissed" | "edited" =
      bodyResult.data.action ??
      (finding.status === FindingStatus.ACCEPTED
        ? "accepted"
        : finding.status === FindingStatus.DISMISSED
          ? "dismissed"
          : "edited");

    const updatedFinding = await app.prisma.$transaction(async (tx) => {
      await tx.reviewFeedback.create({
        data: {
          findingId: finding.id,
          action: toFeedbackAction(inferredAction),
          rationale: bodyResult.data.rationale,
          correctedSeverity: bodyResult.data.correctedSeverity
            ? toFindingSeverity(bodyResult.data.correctedSeverity)
            : undefined,
          correctedTitle: bodyResult.data.correctedTitle
        }
      });

      return tx.finding.update({
        where: {
          id: finding.id
        },
        data: {
          status:
            inferredAction === "accepted"
              ? FindingStatus.ACCEPTED
              : inferredAction === "dismissed"
                ? FindingStatus.DISMISSED
                : FindingStatus.NEEDS_EDIT,
          ...(bodyResult.data.correctedSeverity
            ? { severity: toFindingSeverity(bodyResult.data.correctedSeverity) }
            : {}),
          ...(bodyResult.data.correctedTitle
            ? { title: bodyResult.data.correctedTitle }
            : {})
        },
        include: {
          evidenceSpan: {
            select: {
              id: true,
              startOffset: true,
              endOffset: true,
              excerpt: true,
              pageNumber: true
            }
          }
        }
      });
    });

    return reply.status(201).send({
      finding: updatedFinding
    });
  });
};

export default findingRoutes;
