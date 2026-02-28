import {
  bulkReviewIdParamsSchema,
  compareReviewsBodySchema,
  createBulkReviewBodySchema,
  createReviewBodySchema,
  reviewIdParamsSchema
} from "@double-face/shared-types";
import {
  FindingSeverity,
  FindingStatus,
  LlmProvider,
  ReviewRunStatus
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { runSpecialistAgentsForReview } from "../modules/agents/orchestrator";
import type { AgentName } from "../modules/agents/runtime";
import { buildAdaptiveFindingTypeBoosts } from "../modules/feedback/adaptive-ranking";
import { detectContractLanguage } from "../modules/ingest/language";
import {
  resolveHumanEscalationConfig,
  toConfidenceNumber
} from "../modules/review-workflow/human-escalation";

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

const reviewExportSeverityBuckets: FindingSeverity[] = [
  FindingSeverity.CRITICAL,
  FindingSeverity.HIGH,
  FindingSeverity.MEDIUM,
  FindingSeverity.LOW,
  FindingSeverity.INFO
];

const reviewExportStatusBuckets: FindingStatus[] = [
  FindingStatus.OPEN,
  FindingStatus.ACCEPTED,
  FindingStatus.DISMISSED,
  FindingStatus.NEEDS_EDIT
];

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
const BULK_REVIEW_TRACKING_TTL_SECONDS = Number(
  process.env.BULK_REVIEW_TRACKING_TTL_SECONDS ?? 86_400
);

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

type BulkReviewTrackingItem = {
  contractVersionId: string;
  reviewRunId: string | null;
  status: "queued" | "failed";
  error: string | null;
};

type BulkReviewTrackingRecord = {
  createdAt: string;
  items: BulkReviewTrackingItem[];
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

function getBulkReviewTrackingRedisKey(userId: string, bulkReviewId: string) {
  return `bulk-review-tracking:${userId}:${bulkReviewId}`;
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

function toReviewExportSummary(
  findings: Array<{
    severity: FindingSeverity;
    status: FindingStatus;
  }>
) {
  const bySeverity = Object.fromEntries(
    reviewExportSeverityBuckets.map((severity) => [severity, 0])
  ) as Record<FindingSeverity, number>;
  const byStatus = Object.fromEntries(
    reviewExportStatusBuckets.map((status) => [status, 0])
  ) as Record<FindingStatus, number>;

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byStatus[finding.status] += 1;
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    byStatus
  };
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
        const adaptiveTypeBoosts = await buildAdaptiveFindingTypeBoosts(
          app.prisma,
          request.auth.userId
        );

        const reviewRun = await app.prisma.reviewRun.create({
          data: {
            contractVersionId: contractVersion.id,
            profileId: profile.id,
            provider,
            providerModel,
            status: ReviewRunStatus.QUEUED,
            orchestrationMeta: {
              selectedAgents,
              progressPercent: 0,
              adaptiveTypeBoosts
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
    "/bulk",
    {
      preHandler: app.buildValidationPreHandler({
        body: createBulkReviewBodySchema
      })
    },
    async (request, reply) => {
      const body = request.validated.body as {
        contractVersionIds: string[];
        profileId?: string;
        provider?: LlmProvider;
        selectedAgents?: string[];
      };

      const selectedAgents = normalizeSelectedAgents(body.selectedAgents);
      if (!selectedAgents) {
        return reply.status(400).send({
          error: "INVALID_SELECTED_AGENTS"
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

      const provider = body.provider ?? profile.defaultProvider;
      const providerModel = getProviderModel(provider);
      const adaptiveTypeBoosts = await buildAdaptiveFindingTypeBoosts(
        app.prisma,
        request.auth.userId
      );

      const uniqueContractVersionIds = Array.from(new Set(body.contractVersionIds));
      const trackedItems = [] as BulkReviewTrackingItem[];
      const responseItems = [] as Array<{
        contractVersionId: string;
        reviewRunId: string | null;
        queueJobId: string | number | null;
        status: "queued" | "failed";
        error: string | null;
      }>;

      for (const contractVersionId of uniqueContractVersionIds) {
        const contractVersion = await app.rbac.getOwnedContractVersion(
          contractVersionId,
          request.auth.userId
        );
        if (!contractVersion) {
          trackedItems.push({
            contractVersionId,
            reviewRunId: null,
            status: "failed",
            error: "CONTRACT_VERSION_NOT_FOUND"
          });
          responseItems.push({
            contractVersionId,
            reviewRunId: null,
            queueJobId: null,
            status: "failed",
            error: "CONTRACT_VERSION_NOT_FOUND"
          });
          continue;
        }

        try {
          const reviewRun = await app.prisma.reviewRun.create({
            data: {
              contractVersionId: contractVersion.id,
              profileId: profile.id,
              provider,
              providerModel,
              status: ReviewRunStatus.QUEUED,
              orchestrationMeta: {
                selectedAgents,
                progressPercent: 0,
                adaptiveTypeBoosts
              }
            },
            select: {
              id: true,
              contractVersionId: true,
              profileId: true,
              provider: true
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

          trackedItems.push({
            contractVersionId,
            reviewRunId: reviewRun.id,
            status: "queued",
            error: null
          });
          responseItems.push({
            contractVersionId,
            reviewRunId: reviewRun.id,
            queueJobId: queueJob.id ?? reviewRun.id,
            status: "queued",
            error: null
          });
        } catch (error) {
          const errorCode =
            error instanceof Error ? error.message : "BULK_REVIEW_QUEUE_FAILED";

          trackedItems.push({
            contractVersionId,
            reviewRunId: null,
            status: "failed",
            error: errorCode
          });
          responseItems.push({
            contractVersionId,
            reviewRunId: null,
            queueJobId: null,
            status: "failed",
            error: errorCode
          });
        }
      }

      const bulkReviewId = randomUUID();
      const trackingRecord: BulkReviewTrackingRecord = {
        createdAt: new Date().toISOString(),
        items: trackedItems
      };
      await app.redis.set(
        getBulkReviewTrackingRedisKey(request.auth.userId, bulkReviewId),
        JSON.stringify(trackingRecord),
        "EX",
        BULK_REVIEW_TRACKING_TTL_SECONDS
      );

      return reply.status(202).send({
        bulkReviewId,
        createdAt: trackingRecord.createdAt,
        queuedCount: responseItems.filter((item) => item.status === "queued").length,
        failedCount: responseItems.filter((item) => item.status === "failed").length,
        items: responseItems
      });
    }
  );

  app.get(
    "/bulk/:id",
    {
      preHandler: app.buildValidationPreHandler({
        params: bulkReviewIdParamsSchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };

      const trackingRecordRaw = await app.redis.get(
        getBulkReviewTrackingRedisKey(request.auth.userId, params.id)
      );
      if (!trackingRecordRaw) {
        return reply.status(404).send({
          error: "BULK_REVIEW_NOT_FOUND"
        });
      }

      const trackingRecord = JSON.parse(trackingRecordRaw) as BulkReviewTrackingRecord;
      const reviewRunIds = trackingRecord.items
        .map((item) => item.reviewRunId)
        .filter((item): item is string => Boolean(item));

      const reviewRuns =
        reviewRunIds.length === 0
          ? []
          : await app.prisma.reviewRun.findMany({
              where: {
                id: {
                  in: reviewRunIds
                },
                contractVersion: {
                  contract: {
                    ownerId: request.auth.userId
                  }
                }
              },
              select: {
                id: true,
                status: true,
                orchestrationMeta: true,
                provider: true,
                providerModel: true,
                errorCode: true,
                errorMessage: true,
                createdAt: true,
                updatedAt: true
              }
            });

      const reviewRunsById = new Map(reviewRuns.map((reviewRun) => [reviewRun.id, reviewRun]));
      const items = trackingRecord.items.map((item) => {
        if (!item.reviewRunId) {
          return {
            contractVersionId: item.contractVersionId,
            reviewRunId: null,
            status: "FAILED" as const,
            progressPercent: 0,
            provider: null,
            providerModel: null,
            errorCode: item.error,
            errorMessage: item.error,
            createdAt: null,
            updatedAt: null
          };
        }

        const reviewRun = reviewRunsById.get(item.reviewRunId);
        if (!reviewRun) {
          return {
            contractVersionId: item.contractVersionId,
            reviewRunId: item.reviewRunId,
            status: "FAILED" as const,
            progressPercent: 0,
            provider: null,
            providerModel: null,
            errorCode: "REVIEW_RUN_NOT_FOUND",
            errorMessage: "REVIEW_RUN_NOT_FOUND",
            createdAt: null,
            updatedAt: null
          };
        }

        const metadata = (reviewRun.orchestrationMeta ?? {}) as Record<string, unknown>;

        return {
          contractVersionId: item.contractVersionId,
          reviewRunId: reviewRun.id,
          status: reviewRun.status,
          progressPercent: getProgressFromStatus(reviewRun.status, metadata),
          provider: reviewRun.provider,
          providerModel: reviewRun.providerModel,
          errorCode: reviewRun.errorCode,
          errorMessage: reviewRun.errorMessage,
          createdAt: reviewRun.createdAt,
          updatedAt: reviewRun.updatedAt
        };
      });

      const summary = {
        total: items.length,
        queued: items.filter((item) => item.status === "QUEUED").length,
        running: items.filter((item) => item.status === "RUNNING").length,
        completed: items.filter((item) => item.status === "COMPLETED").length,
        failed: items.filter((item) => item.status === "FAILED").length,
        cancelled: items.filter((item) => item.status === "CANCELLED").length
      };

      return reply.status(200).send({
        bulkReviewId: params.id,
        createdAt: trackingRecord.createdAt,
        summary,
        items
      });
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
      const adaptiveTypeBoosts = await buildAdaptiveFindingTypeBoosts(
        app.prisma,
        request.auth.userId
      );

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

      const detectedLanguage = detectContractLanguage(
        clauses.map((clause) => clause.normalizedText).join("\n")
      );
      const runtimeLanguage =
        detectedLanguage.iso6391 && detectedLanguage.iso6391.length >= 2
          ? detectedLanguage.iso6391
          : "en";

      const runtimeInputBase = {
        contractId: contractVersion.contractId,
        contractVersionId: contractVersion.id,
        contractType: undefined,
        jurisdiction: undefined,
        language: runtimeLanguage,
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
          selectedAgents,
          {
            adaptiveTypeBoosts
          }
        ),
        runSpecialistAgentsForReview(
          {
            ...runtimeInputBase,
            reviewRunId: randomUUID()
          },
          selectedAgents,
          {
            adaptiveTypeBoosts
          }
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
        adaptiveTypeBoosts,
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
    "/:id/escalations",
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

      const profile = await app.prisma.policyProfile.findFirst({
        where: {
          id: reviewRun.profileId,
          userId: request.auth.userId
        },
        select: {
          riskThresholds: true
        }
      });

      if (!profile) {
        return reply.status(404).send({
          error: "POLICY_PROFILE_NOT_FOUND"
        });
      }

      const escalationConfig = resolveHumanEscalationConfig(profile.riskThresholds);
      if (!escalationConfig.enabled) {
        return reply.status(200).send({
          enabled: false,
          minConfidence: escalationConfig.minConfidence,
          queuedCount: 0,
          items: []
        });
      }

      const findings = await app.prisma.finding.findMany({
        where: {
          contractVersionId: reviewRun.contractVersionId,
          status: {
            in: [FindingStatus.OPEN, FindingStatus.NEEDS_EDIT]
          }
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
        },
        orderBy: [
          {
            confidence: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      });

      const escalationItems = findings
        .map((finding) => ({
          ...finding,
          confidence: toConfidenceNumber(finding.confidence)
        }))
        .filter((finding) => finding.confidence < escalationConfig.minConfidence)
        .map((finding) => ({
          findingId: finding.id,
          contractVersionId: finding.contractVersionId,
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
          confidence: finding.confidence,
          threshold: escalationConfig.minConfidence,
          evidenceSpan: finding.evidenceSpan,
          createdAt: finding.createdAt
        }));

      return reply.status(200).send({
        enabled: true,
        minConfidence: escalationConfig.minConfidence,
        queuedCount: escalationItems.length,
        items: escalationItems
      });
    }
  );

  app.get(
    "/:id/export",
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

      const findings = await app.prisma.finding.findMany({
        where: {
          contractVersionId: reviewRun.contractVersionId
        },
        include: {
          evidenceSpan: {
            select: {
              id: true,
              startOffset: true,
              endOffset: true,
              excerpt: true,
              pageNumber: true,
              createdAt: true
            }
          }
        },
        orderBy: [
          {
            createdAt: "asc"
          },
          {
            id: "asc"
          }
        ]
      });

      const exportedFindings = findings.map((finding) => ({
        id: finding.id,
        contractVersionId: finding.contractVersionId,
        clauseId: finding.clauseId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        status: finding.status,
        confidence: toConfidenceNumber(finding.confidence),
        createdAt: finding.createdAt.toISOString(),
        updatedAt: finding.updatedAt.toISOString(),
        evidence: {
          id: finding.evidenceSpan.id,
          startOffset: finding.evidenceSpan.startOffset,
          endOffset: finding.evidenceSpan.endOffset,
          excerpt: finding.evidenceSpan.excerpt,
          pageNumber: finding.evidenceSpan.pageNumber,
          createdAt: finding.evidenceSpan.createdAt.toISOString()
        }
      }));

      const artifact = {
        schemaVersion: "1.0",
        generatedAt: new Date().toISOString(),
        reviewRun: {
          id: reviewRun.id,
          contractVersionId: reviewRun.contractVersionId,
          profileId: reviewRun.profileId,
          provider: reviewRun.provider,
          providerModel: reviewRun.providerModel,
          status: reviewRun.status,
          startedAt: reviewRun.startedAt ? reviewRun.startedAt.toISOString() : null,
          finishedAt: reviewRun.finishedAt ? reviewRun.finishedAt.toISOString() : null,
          errorCode: reviewRun.errorCode,
          errorMessage: reviewRun.errorMessage,
          createdAt: reviewRun.createdAt.toISOString(),
          updatedAt: reviewRun.updatedAt.toISOString()
        },
        summary: toReviewExportSummary(exportedFindings),
        findings: exportedFindings
      };

      return reply.status(200).send({
        fileName: `review-export-${reviewRun.id}.json`,
        artifact
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
