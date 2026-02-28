import { ContractProcessingStatus, ReviewRunStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { verifyInternalToken } from "../modules/security/internal-token";

const stateUpdateBodySchema = z.object({
  resourceType: z.enum(["contract", "review-run"]),
  resourceId: z.string().uuid(),
  status: z.string().min(1),
  progressPercent: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

function toContractStatus(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CREATED") return ContractProcessingStatus.CREATED;
  if (normalized === "UPLOADING") return ContractProcessingStatus.UPLOADING;
  if (normalized === "QUEUED") return ContractProcessingStatus.QUEUED;
  if (normalized === "INGESTING") return ContractProcessingStatus.INGESTING;
  if (normalized === "READY") return ContractProcessingStatus.READY;
  if (normalized === "FAILED") return ContractProcessingStatus.FAILED;

  throw new Error(`INVALID_CONTRACT_STATUS:${status}`);
}

function toReviewRunStatus(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "QUEUED") return ReviewRunStatus.QUEUED;
  if (normalized === "RUNNING") return ReviewRunStatus.RUNNING;
  if (normalized === "COMPLETED") return ReviewRunStatus.COMPLETED;
  if (normalized === "FAILED") return ReviewRunStatus.FAILED;
  if (normalized === "CANCELLED") return ReviewRunStatus.CANCELLED;

  throw new Error(`INVALID_REVIEW_STATUS:${status}`);
}

const internalJobRoutes: FastifyPluginAsync = async (app) => {
  app.post("/state-update", async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "UNAUTHORIZED_INTERNAL"
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    try {
      await verifyInternalToken(token, "job-state:update");
    } catch {
      return reply.status(401).send({
        error: "UNAUTHORIZED_INTERNAL"
      });
    }

    const parseResult = stateUpdateBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    if (parseResult.data.resourceType === "contract") {
      const status = toContractStatus(parseResult.data.status);

      await app.prisma.contract.update({
        where: {
          id: parseResult.data.resourceId
        },
        data: {
          status
        }
      });

      return reply.status(200).send({
        updated: true
      });
    }

    const status = toReviewRunStatus(parseResult.data.status);

    const reviewRun = await app.prisma.reviewRun.findUnique({
      where: {
        id: parseResult.data.resourceId
      },
      select: {
        orchestrationMeta: true
      }
    });

    const existingMeta =
      (reviewRun?.orchestrationMeta as Record<string, unknown> | null) ?? {};

    const nextMeta = {
      ...existingMeta,
      ...(parseResult.data.metadata ?? {}),
      ...(parseResult.data.progressPercent !== undefined
        ? { progressPercent: parseResult.data.progressPercent }
        : {})
    };

    await app.prisma.reviewRun.update({
      where: {
        id: parseResult.data.resourceId
      },
      data: {
        status,
        orchestrationMeta: nextMeta,
        ...(status === ReviewRunStatus.RUNNING ? { startedAt: new Date() } : {}),
        ...(status === ReviewRunStatus.COMPLETED || status === ReviewRunStatus.FAILED
          ? { finishedAt: new Date() }
          : {})
      }
    });

    return reply.status(200).send({
      updated: true
    });
  });
};

export default internalJobRoutes;
