import { createReviewBodySchema, reviewIdParamsSchema } from "@legal-tech/shared-types";
import { LlmProvider, ReviewRunStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

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

const IDEMPOTENCY_HEADER_NAME = "idempotency-key";
const IDEMPOTENCY_TTL_SECONDS = Number(process.env.REVIEW_IDEMPOTENCY_TTL_SECONDS ?? 86_400);

type ReviewIdempotencyRecord = {
  requestHash: string;
  status: "in-progress" | "completed";
  response?: {
    reviewRun: {
      id: string;
      contractVersionId: string;
      profileId: string;
      provider: LlmProvider;
      providerModel: string;
      status: ReviewRunStatus;
      createdAt: Date;
    };
    queued: true;
    queueJobId: string | number;
  };
  createdAt: string;
};

function buildReviewRequestHash(payload: {
  contractVersionId: string;
  profileId?: string;
  provider?: LlmProvider;
  selectedAgents?: string[];
}) {
  const normalizedPayload = {
    contractVersionId: payload.contractVersionId,
    profileId: payload.profileId ?? null,
    provider: payload.provider ?? null,
    selectedAgents: [...(payload.selectedAgents ?? [])].sort()
  };

  return createHash("sha256").update(JSON.stringify(normalizedPayload)).digest("hex");
}

function getIdempotencyHeader(request: { headers: Record<string, unknown> }) {
  const raw =
    request.headers[IDEMPOTENCY_HEADER_NAME] ??
    request.headers[IDEMPOTENCY_HEADER_NAME.toUpperCase()];
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  return value.length > 0 ? value : null;
}

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
  app.post(
    "/",
    {
      preHandler: app.buildValidationPreHandler({
        body: createReviewBodySchema
      })
    },
    async (request, reply) => {
      const body = request.validated.body as {
        contractVersionId: string;
        profileId?: string;
        provider?: LlmProvider;
        selectedAgents?: string[];
      };

      const idempotencyKey = getIdempotencyHeader(request);
      const requestHash = buildReviewRequestHash(body);
      const idempotencyRedisKey = idempotencyKey
        ? `idempotency:reviews:${request.auth.userId}:${idempotencyKey}`
        : null;

      if (idempotencyRedisKey) {
        const existingRecordRaw = await app.redis.get(idempotencyRedisKey);
        if (existingRecordRaw) {
          const existingRecord = JSON.parse(existingRecordRaw) as ReviewIdempotencyRecord;

          if (existingRecord.requestHash !== requestHash) {
            return reply.status(409).send({
              error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
            });
          }

          if (existingRecord.status === "completed" && existingRecord.response) {
            return reply.status(200).send({
              ...existingRecord.response,
              idempotentReplay: true
            });
          }

          return reply.status(409).send({
            error: "IDEMPOTENT_REQUEST_IN_PROGRESS"
          });
        }

        const reservationPayload: ReviewIdempotencyRecord = {
          requestHash,
          status: "in-progress",
          createdAt: new Date().toISOString()
        };
        const reserved = await app.redis.set(
          idempotencyRedisKey,
          JSON.stringify(reservationPayload),
          "EX",
          IDEMPOTENCY_TTL_SECONDS,
          "NX"
        );

        if (reserved !== "OK") {
          return reply.status(409).send({
            error: "IDEMPOTENT_REQUEST_IN_PROGRESS"
          });
        }
      }

      try {
        const contractVersion = await app.prisma.contractVersion.findFirst({
          where: {
            id: body.contractVersionId,
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
          if (idempotencyRedisKey) {
            await app.redis.del(idempotencyRedisKey);
          }
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

        if (body.profileId) {
          profile = await app.prisma.policyProfile.findFirst({
            where: {
              id: body.profileId,
              userId: request.auth.userId
            },
            select: {
              id: true,
              defaultProvider: true
            }
          });

          if (!profile) {
            if (idempotencyRedisKey) {
              await app.redis.del(idempotencyRedisKey);
            }
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

        const provider = body.provider ?? profile.defaultProvider;
        const providerModel = getProviderModel(provider);
        const selectedAgents = body.selectedAgents ?? [
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

        const responsePayload = {
          reviewRun,
          queued: true as const,
          queueJobId: queueJob.id ?? reviewRun.id
        };

        if (idempotencyRedisKey) {
          const completedPayload: ReviewIdempotencyRecord = {
            requestHash,
            status: "completed",
            response: responsePayload,
            createdAt: new Date().toISOString()
          };
          await app.redis.set(
            idempotencyRedisKey,
            JSON.stringify(completedPayload),
            "EX",
            IDEMPOTENCY_TTL_SECONDS
          );
        }

        return reply.status(202).send(responsePayload);
      } catch (error) {
        if (idempotencyRedisKey) {
          await app.redis.del(idempotencyRedisKey);
        }
        throw error;
      }
    }
  );

  app.get(
    "/:id",
    {
      preHandler: app.buildValidationPreHandler({
        params: reviewIdParamsSchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };

      const reviewRun = await getReviewRunForUser(
      app,
      params.id,
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
    }
  );

  app.get(
    "/:id/events",
    {
      preHandler: app.buildValidationPreHandler({
        params: reviewIdParamsSchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };

      const reviewRun = await getReviewRunForUser(
      app,
      params.id,
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
        params.id,
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
    }
  );
};

export default reviewRoutes;
