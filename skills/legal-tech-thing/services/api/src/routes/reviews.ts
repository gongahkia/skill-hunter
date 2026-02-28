import {
  compareReviewsBodySchema,
  createReviewBodySchema,
  reviewIdParamsSchema
} from "@legal-tech/shared-types";
import { LlmProvider, ReviewRunStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { runSpecialistAgentsForReview } from "../modules/agents/orchestrator";
import type { AgentName } from "../modules/agents/runtime";

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
const defaultSelectedAgents: AgentName[] = [
  "risk-scanner",
  "missing-clause",
  "ambiguity",
  "compliance",
  "cross-clause-conflict"
];
const selectedAgentSet = new Set<AgentName>(defaultSelectedAgents);
type ComparableFinding = Awaited<ReturnType<typeof runSpecialistAgentsForReview>>["findings"][number];

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

function normalizeSelectedAgents(selectedAgents?: string[]) {
  if (!selectedAgents || selectedAgents.length === 0) {
    return [...defaultSelectedAgents];
  }

  const normalized = Array.from(new Set(selectedAgents.map((item) => item.trim())));
  if (normalized.some((agent) => !selectedAgentSet.has(agent as AgentName))) {
    return null;
  }

  return normalized as AgentName[];
}

async function getOrCreateReviewProfile(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  profileId?: string
) {
  if (profileId) {
    return app.prisma.policyProfile.findFirst({
      where: {
        id: profileId,
        userId
      },
      select: {
        id: true,
        defaultProvider: true
      }
    });
  }

  const existing = await app.prisma.policyProfile.findFirst({
    where: {
      userId
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      defaultProvider: true
    }
  });

  if (existing) {
    return existing;
  }

  return app.prisma.policyProfile.create({
    data: {
      userId,
      defaultProvider: LlmProvider.OPENAI,
      riskThresholds: defaultRiskThresholds
    },
    select: {
      id: true,
      defaultProvider: true
    }
  });
}

function buildFindingComparisonKey(finding: ComparableFinding) {
  const evidenceKey = finding.evidence
    .map((item) => `${item.clauseId ?? "none"}:${item.startOffset}:${item.endOffset}`)
    .sort()
    .join("|");

  return `${finding.type}:${finding.title.trim().toLowerCase()}:${evidenceKey}`;
}

async function getReviewRunForUser(
  app: Parameters<FastifyPluginAsync>[0],
  reviewRunId: string,
  userId: string
) {
  return app.rbac.getOwnedReviewRun(reviewRunId, userId);
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
        const contractVersion = await app.rbac.getOwnedContractVersion(
          body.contractVersionId,
          request.auth.userId
        );

        if (!contractVersion) {
          if (idempotencyRedisKey) {
            await app.redis.del(idempotencyRedisKey);
          }
          return reply.status(404).send({
            error: "CONTRACT_VERSION_NOT_FOUND"
          });
        }

        const profile = await getOrCreateReviewProfile(
          app,
          request.auth.userId,
          body.profileId
        );

        if (!profile) {
          if (idempotencyRedisKey) {
            await app.redis.del(idempotencyRedisKey);
          }
          return reply.status(404).send({
            error: "POLICY_PROFILE_NOT_FOUND"
          });
        }

        const provider = body.provider ?? profile.defaultProvider;
        const providerModel = getProviderModel(provider);
        const selectedAgents = normalizeSelectedAgents(body.selectedAgents);

        if (!selectedAgents) {
          if (idempotencyRedisKey) {
            await app.redis.del(idempotencyRedisKey);
          }
          return reply.status(400).send({
            error: "INVALID_SELECTED_AGENTS"
          });
        }

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

  app.post(
    "/compare",
    {
      preHandler: app.buildValidationPreHandler({
        body: compareReviewsBodySchema
      })
    },
    async (request, reply) => {
      const body = request.validated.body as {
        contractVersionId: string;
        profileId?: string;
        primaryProvider?: LlmProvider;
        comparisonProvider: LlmProvider;
        selectedAgents?: string[];
      };

      const selectedAgents = normalizeSelectedAgents(body.selectedAgents);
      if (!selectedAgents) {
        return reply.status(400).send({
          error: "INVALID_SELECTED_AGENTS"
        });
      }

      const contractVersion = await app.rbac.getOwnedContractVersion(
        body.contractVersionId,
        request.auth.userId
      );
      if (!contractVersion) {
        return reply.status(404).send({
          error: "CONTRACT_VERSION_NOT_FOUND"
        });
      }

      const profile = await getOrCreateReviewProfile(
        app,
        request.auth.userId,
        body.profileId
      );
      if (!profile) {
        return reply.status(404).send({
          error: "POLICY_PROFILE_NOT_FOUND"
        });
      }

      const primaryProvider = body.primaryProvider ?? profile.defaultProvider;
      const comparisonProvider = body.comparisonProvider;
      if (primaryProvider === comparisonProvider) {
        return reply.status(400).send({
          error: "COMPARISON_PROVIDERS_MUST_DIFFER"
        });
      }

      const clauses = await app.prisma.clause.findMany({
        where: {
          contractVersionId: contractVersion.id
        },
        orderBy: {
          startOffset: "asc"
        },
        select: {
          id: true,
          type: true,
          normalizedText: true,
          startOffset: true,
          endOffset: true
        }
      });

      const policyRules = await app.prisma.policyRule.findMany({
        where: {
          profileId: profile.id,
          active: true
        },
        orderBy: [
          {
            priority: "asc"
          },
          {
            createdAt: "asc"
          }
        ],
        select: {
          id: true,
          clauseRequirement: true,
          clauseSelector: true,
          requiredPattern: true,
          forbiddenPattern: true,
          allowException: true,
          active: true,
          priority: true
        }
      });

      const runtimeInputBase = {
        contractId: contractVersion.contractId,
        contractVersionId: contractVersion.id,
        contractType: undefined,
        jurisdiction: undefined,
        language: "en",
        policyProfileId: profile.id,
        policyRules,
        clauses: clauses.map((clause) => ({
          id: clause.id,
          heading: null,
          type: clause.type,
          text: clause.normalizedText,
          startOffset: clause.startOffset,
          endOffset: clause.endOffset
        }))
      };

      const [primaryResult, comparisonResult] = await Promise.all([
        runSpecialistAgentsForReview(
          {
            ...runtimeInputBase,
            reviewRunId: randomUUID()
          },
          selectedAgents
        ),
        runSpecialistAgentsForReview(
          {
            ...runtimeInputBase,
            reviewRunId: randomUUID()
          },
          selectedAgents
        )
      ]);

      const primaryByKey = new Map<string, ComparableFinding>();
      for (const finding of primaryResult.findings) {
        primaryByKey.set(buildFindingComparisonKey(finding), finding);
      }

      const comparisonByKey = new Map<string, ComparableFinding>();
      for (const finding of comparisonResult.findings) {
        comparisonByKey.set(buildFindingComparisonKey(finding), finding);
      }

      const introduced = [] as Array<{
        key: string;
        type: ComparableFinding["type"];
        title: string;
        severity: ComparableFinding["severity"];
        confidence: number;
      }>;
      const resolved = [] as Array<{
        key: string;
        type: ComparableFinding["type"];
        title: string;
        severity: ComparableFinding["severity"];
        confidence: number;
      }>;
      const changed = [] as Array<{
        key: string;
        title: string;
        primarySeverity: ComparableFinding["severity"];
        comparisonSeverity: ComparableFinding["severity"];
        primaryConfidence: number;
        comparisonConfidence: number;
      }>;
      const unchanged = [] as Array<{
        key: string;
        type: ComparableFinding["type"];
        title: string;
        severity: ComparableFinding["severity"];
        confidence: number;
      }>;

      for (const [key, finding] of comparisonByKey) {
        const primary = primaryByKey.get(key);
        if (!primary) {
          introduced.push({
            key,
            type: finding.type,
            title: finding.title,
            severity: finding.severity,
            confidence: finding.confidence
          });
          continue;
        }

        if (
          primary.severity !== finding.severity ||
          Math.abs(primary.confidence - finding.confidence) >= 0.0001
        ) {
          changed.push({
            key,
            title: finding.title,
            primarySeverity: primary.severity,
            comparisonSeverity: finding.severity,
            primaryConfidence: primary.confidence,
            comparisonConfidence: finding.confidence
          });
          continue;
        }

        unchanged.push({
          key,
          type: finding.type,
          title: finding.title,
          severity: finding.severity,
          confidence: finding.confidence
        });
      }

      for (const [key, finding] of primaryByKey) {
        if (comparisonByKey.has(key)) {
          continue;
        }

        resolved.push({
          key,
          type: finding.type,
          title: finding.title,
          severity: finding.severity,
          confidence: finding.confidence
        });
      }

      return reply.status(200).send({
        contractVersionId: contractVersion.id,
        providers: {
          primary: primaryProvider,
          primaryModel: getProviderModel(primaryProvider),
          comparison: comparisonProvider,
          comparisonModel: getProviderModel(comparisonProvider)
        },
        selectedAgents,
        counts: {
          primary: primaryResult.findings.length,
          comparison: comparisonResult.findings.length,
          introduced: introduced.length,
          resolved: resolved.length,
          changed: changed.length,
          unchanged: unchanged.length
        },
        deltas: {
          introduced,
          resolved,
          changed,
          unchanged
        }
      });
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
