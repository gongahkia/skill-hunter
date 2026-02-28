import { LlmProvider, ReviewRunStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createReviewBodySchema = z.object({
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  provider: z.nativeEnum(LlmProvider).optional(),
  selectedAgents: z.array(z.string().min(1)).min(1).optional()
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

const defaultRiskThresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
};

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
          selectedAgents
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
};

export default reviewRoutes;
