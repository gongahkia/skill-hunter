import { LlmProvider } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const riskThresholdsSchema = z.object({
  criticalMinConfidence: z.number().min(0).max(1),
  highMinConfidence: z.number().min(0).max(1),
  mediumMinConfidence: z.number().min(0).max(1),
  autoEscalateSeverity: z.enum(["critical", "high", "medium", "low", "info"])
});

const enabledAgentsSchema = z.object({
  riskScanner: z.boolean(),
  missingClause: z.boolean(),
  ambiguity: z.boolean(),
  compliance: z.boolean(),
  crossClauseConflict: z.boolean()
});

const updatePolicyProfileBodySchema = z.object({
  defaultProvider: z.nativeEnum(LlmProvider).optional(),
  thresholds: riskThresholdsSchema.optional(),
  enabledAgents: enabledAgentsSchema.optional()
});

const defaultRiskThresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
};

const defaultEnabledAgents = {
  riskScanner: true,
  missingClause: true,
  ambiguity: true,
  compliance: true,
  crossClauseConflict: true
};

const policyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profiles/me", async (request, reply) => {
    let profile = await app.prisma.policyProfile.findFirst({
      where: {
        userId: request.auth.userId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!profile) {
      profile = await app.prisma.policyProfile.create({
        data: {
          userId: request.auth.userId,
          defaultProvider: LlmProvider.OPENAI,
          riskThresholds: {
            thresholds: defaultRiskThresholds,
            enabledAgents: defaultEnabledAgents
          }
        }
      });
    }

    return reply.status(200).send({
      profile
    });
  });

  app.put("/profiles/me", async (request, reply) => {
    const parseResult = updatePolicyProfileBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const currentProfile = await app.prisma.policyProfile.findFirst({
      where: {
        userId: request.auth.userId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const existingRiskThresholds =
      (currentProfile?.riskThresholds as Record<string, unknown> | null) ?? {};

    const nextRiskThresholds = {
      ...existingRiskThresholds,
      ...(parseResult.data.thresholds
        ? {
            thresholds: parseResult.data.thresholds
          }
        : {}),
      ...(parseResult.data.enabledAgents
        ? {
            enabledAgents: parseResult.data.enabledAgents
          }
        : {})
    };

    const profile = currentProfile
      ? await app.prisma.policyProfile.update({
          where: {
            id: currentProfile.id
          },
          data: {
            defaultProvider:
              parseResult.data.defaultProvider ?? currentProfile.defaultProvider,
            riskThresholds: nextRiskThresholds
          }
        })
      : await app.prisma.policyProfile.create({
          data: {
            userId: request.auth.userId,
            defaultProvider:
              parseResult.data.defaultProvider ?? LlmProvider.OPENAI,
            riskThresholds:
              Object.keys(nextRiskThresholds).length > 0
                ? nextRiskThresholds
                : {
                    thresholds: defaultRiskThresholds,
                    enabledAgents: defaultEnabledAgents
                  }
          }
        });

    return reply.status(200).send({
      profile
    });
  });
};

export default policyRoutes;
