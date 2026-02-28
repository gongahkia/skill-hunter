import {
  createFeedbackBodySchema,
  findingIdParamsSchema,
  updateFindingBodySchema
} from "@legal-tech/shared-types";
import { FeedbackAction, FindingSeverity, FindingStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

function toFindingStatus(status: "open" | "accepted" | "dismissed" | "needs-edit") {
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
  app.patch(
    "/:id",
    {
      preHandler: app.buildValidationPreHandler({
        params: findingIdParamsSchema,
        body: updateFindingBodySchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };
      const body = request.validated.body as {
        status: "open" | "accepted" | "dismissed" | "needs-edit";
      };

      const finding = await app.rbac.getOwnedFinding(params.id, request.auth.userId);

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
          status: toFindingStatus(body.status)
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
    }
  );

  app.post(
    "/:id/feedback",
    {
      preHandler: app.buildValidationPreHandler({
        params: findingIdParamsSchema,
        body: createFeedbackBodySchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };
      const body = request.validated.body as {
        action?: "accepted" | "dismissed" | "edited";
        rationale: string;
        correctedSeverity?: "critical" | "high" | "medium" | "low" | "info";
        correctedTitle?: string;
      };

      const finding = await app.rbac.getOwnedFinding(params.id, request.auth.userId);

    if (!finding) {
      return reply.status(404).send({
        error: "FINDING_NOT_FOUND"
      });
    }

      const inferredAction: "accepted" | "dismissed" | "edited" =
        body.action ??
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
            rationale: body.rationale,
          correctedSeverity: body.correctedSeverity
            ? toFindingSeverity(body.correctedSeverity)
            : undefined,
            correctedTitle: body.correctedTitle
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
            ...(body.correctedSeverity
            ? { severity: toFindingSeverity(body.correctedSeverity) }
            : {}),
            ...(body.correctedTitle
            ? { title: body.correctedTitle }
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
    }
  );
};

export default findingRoutes;
