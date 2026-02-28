import { FindingStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const findingIdParamsSchema = z.object({
  id: z.string().uuid()
});

const updateFindingBodySchema = z.object({
  status: z.enum(["open", "accepted", "dismissed", "needs-edit"])
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
};

export default findingRoutes;
