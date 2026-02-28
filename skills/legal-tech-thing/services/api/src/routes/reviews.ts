import { LlmProvider, ReviewRunStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createReviewBodySchema = z.object({
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  provider: z.nativeEnum(LlmProvider).optional(),
  selectedAgents: z.array(z.string().min(1)).min(1).optional()
});

const reviewIdParamsSchema = z.object({
  id: z.string().uuid()
});

function getProviderModel(provider: LlmProvider) {
  if (provider === LlmProvider.OPENAI) {
    return process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";
  }

  if (provider === LlmProvider.ANTHROPIC) {
    return process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
  }

  if (provider === LlmProvider.GEMINI) {
    return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  return process.env.OLLAMA_CHAT_MODEL ?? "llama3.1:8b-instruct";
}

function getProgressFromStatus(status: ReviewRunStatus, metadata: Record<string, unknown>) {
  if (status === ReviewRunStatus.QUEUED) {
    return 0;
  }

  if (status === ReviewRunStatus.RUNNING) {
    const progress = metadata.progressPercent;

    if (typeof progress === "number" && progress >= 0 && progress <= 100) {
      return progress;
    }

    return 50;
  }

  return 100;
}

const defaultRiskThresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
};

async function getReviewRunForUser(
  app: Parameters<FastifyPluginAsync>[0],
  reviewRunId: string,
  userId: string
) {
  return app.prisma.reviewRun.findFirst({
    where: {
      id: reviewRunId,
      contractVersion: {
        contract: {
          ownerId: userId
        }
      }
    },
    select: {
      id: true,
      contractVersionId: true,
      profileId: true,
      provider: true,
      providerModel: true,
      status: true,
      orchestrationMeta: true,
      startedAt: true,
      finishedAt: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parseResult = createReviewBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const contractVersion = await app.prisma.contractVersion.findFirst({
      where: {
        id: parseResult.data.contractVersionId,
        contract: {
          ownerId: request.auth.userId
        }
      },
      select: {
        id: true,
        contractId: true
      }
    });

    if (!contractVersion) {
      return reply.status(404).send({
        error: "CONTRACT_VERSION_NOT_FOUND"
      });
    }

    let profile = null as
      | {
          id: string;
          defaultProvider: LlmProvider;
        }
      | null;

    if (parseResult.data.profileId) {
      profile = await app.prisma.policyProfile.findFirst({
        where: {
          id: parseResult.data.profileId,
          userId: request.auth.userId
        },
        select: {
          id: true,
          defaultProvider: true
        }
      });

      if (!profile) {
        return reply.status(404).send({
          error: "POLICY_PROFILE_NOT_FOUND"
        });
      }
    } else {
      profile = await app.prisma.policyProfile.findFirst({
        where: {
          userId: request.auth.userId
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          defaultProvider: true
        }
      });

      if (!profile) {
        const createdProfile = await app.prisma.policyProfile.create({
          data: {
            userId: request.auth.userId,
            defaultProvider: LlmProvider.OPENAI,
            riskThresholds: defaultRiskThresholds
          },
          select: {
            id: true,
            defaultProvider: true
          }
        });

        profile = createdProfile;
      }
    }

    const provider = parseResult.data.provider ?? profile.defaultProvider;
    const providerModel = getProviderModel(provider);
    const selectedAgents = parseResult.data.selectedAgents ?? [
      "risk-scanner",
      "missing-clause",
      "ambiguity",
      "compliance",
      "cross-clause-conflict"
    ];

    const reviewRun = await app.prisma.reviewRun.create({
      data: {
        contractVersionId: contractVersion.id,
        profileId: profile.id,
        provider,
        providerModel,
        status: ReviewRunStatus.QUEUED,
        orchestrationMeta: {
          selectedAgents,
          progressPercent: 0
        }
      },
      select: {
        id: true,
        contractVersionId: true,
        profileId: true,
        provider: true,
        providerModel: true,
        status: true,
        createdAt: true
      }
    });

    const queueJob = await app.queues.reviewRunQueue.add(
      `review-run:${reviewRun.id}`,
      {
        requestId: request.id,
        reviewRunId: reviewRun.id,
        contractVersionId: reviewRun.contractVersionId,
        profileId: reviewRun.profileId,
        provider: reviewRun.provider,
        selectedAgents
      },
      {
        jobId: reviewRun.id
      }
    );

    return reply.status(202).send({
      reviewRun,
      queued: true,
      queueJobId: queueJob.id
    });
  });

  app.get("/:id", async (request, reply) => {
    const parseResult = reviewIdParamsSchema.safeParse(request.params);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const reviewRun = await getReviewRunForUser(
      app,
      parseResult.data.id,
      request.auth.userId
    );

    if (!reviewRun) {
      return reply.status(404).send({
        error: "REVIEW_RUN_NOT_FOUND"
      });
    }

    const metadata = (reviewRun.orchestrationMeta ?? {}) as Record<string, unknown>;
    const progressPercent = getProgressFromStatus(reviewRun.status, metadata);

    return reply.status(200).send({
      reviewRun: {
        ...reviewRun,
        progressPercent,
        providerMetadata: {
          provider: reviewRun.provider,
          model: reviewRun.providerModel
        }
      }
    });
  });

  app.get("/:id/events", async (request, reply) => {
    const parseResult = reviewIdParamsSchema.safeParse(request.params);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const reviewRun = await getReviewRunForUser(
      app,
      parseResult.data.id,
      request.auth.userId
    );

    if (!reviewRun) {
      return reply.status(404).send({
        error: "REVIEW_RUN_NOT_FOUND"
      });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    reply.raw.flushHeaders?.();

    let lastPayload = "";
    let isClosed = false;

    const sendEvent = (event: string, data: unknown) => {
      if (isClosed) {
        return;
      }

      const payload = JSON.stringify(data);

      if (payload === lastPayload) {
        return;
      }

      lastPayload = payload;
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${payload}\n\n`);
    };

    const pushReviewState = async () => {
      const nextRun = await getReviewRunForUser(
        app,
        parseResult.data.id,
        request.auth.userId
      );

      if (!nextRun) {
        sendEvent("error", { error: "REVIEW_RUN_NOT_FOUND" });
        return;
      }

      const metadata = (nextRun.orchestrationMeta ?? {}) as Record<string, unknown>;
      const progressPercent = getProgressFromStatus(nextRun.status, metadata);

      sendEvent("review-progress", {
        id: nextRun.id,
        status: nextRun.status,
        progressPercent,
        provider: nextRun.provider,
        providerModel: nextRun.providerModel,
        startedAt: nextRun.startedAt,
        finishedAt: nextRun.finishedAt,
        errorCode: nextRun.errorCode,
        errorMessage: nextRun.errorMessage,
        updatedAt: nextRun.updatedAt
      });
    };

    await pushReviewState();

    const interval = setInterval(async () => {
      await pushReviewState();
    }, 2000);

    request.raw.on("close", () => {
      isClosed = true;
      clearInterval(interval);
      reply.raw.end();
    });
  });
};

export default reviewRoutes;
