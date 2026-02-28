import { ClauseType, LlmProvider } from "@prisma/client";
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

const createPolicyRuleBodySchema = z
  .object({
    clauseRequirement: z.nativeEnum(ClauseType).optional(),
    clauseSelector: z.string().min(1),
    requiredPattern: z.string().min(1).optional(),
    forbiddenPattern: z.string().min(1).optional(),
    allowException: z.boolean().default(false),
    active: z.boolean().default(true),
    priority: z.number().int().positive().default(100)
  })
  .superRefine((value, ctx) => {
    if (!value.requiredPattern && !value.forbiddenPattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either requiredPattern or forbiddenPattern must be provided",
        path: ["requiredPattern"]
      });
    }
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

async function getOrCreatePolicyProfile(app: Parameters<FastifyPluginAsync>[0], userId: string) {
  const existingProfile = await app.prisma.policyProfile.findFirst({
    where: {
      userId
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existingProfile) {
    return existingProfile;
  }

  return app.prisma.policyProfile.create({
    data: {
      userId,
      defaultProvider: LlmProvider.OPENAI,
      riskThresholds: {
        thresholds: defaultRiskThresholds,
        enabledAgents: defaultEnabledAgents
      }
    }
  });
}

const policyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profiles/me", async (request, reply) => {
    const profile = await getOrCreatePolicyProfile(app, request.auth.userId);

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

    const currentProfile = await getOrCreatePolicyProfile(app, request.auth.userId);

    const existingRiskThresholds =
      (currentProfile.riskThresholds as Record<string, unknown> | null) ?? {};

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

    const profile = await app.prisma.policyProfile.update({
      where: {
        id: currentProfile.id
      },
      data: {
        defaultProvider:
          parseResult.data.defaultProvider ?? currentProfile.defaultProvider,
        riskThresholds: nextRiskThresholds
      }
    });

    return reply.status(200).send({
      profile
    });
  });

  app.get("/rules", async (request, reply) => {
    const profile = await app.prisma.policyProfile.findFirst({
      where: {
        userId: request.auth.userId
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true
      }
    });

    if (!profile) {
      return reply.status(200).send({
        items: []
      });
    }

    const rules = await app.prisma.policyRule.findMany({
      where: {
        profileId: profile.id,
        active: true
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    });

    return reply.status(200).send({
      items: rules
    });
  });

  app.post("/rules", async (request, reply) => {
    const parseResult = createPolicyRuleBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const profile = await getOrCreatePolicyProfile(app, request.auth.userId);

    const createdRule = await app.prisma.policyRule.create({
      data: {
        profileId: profile.id,
        clauseRequirement: parseResult.data.clauseRequirement,
        clauseSelector: parseResult.data.clauseSelector,
        requiredPattern: parseResult.data.requiredPattern,
        forbiddenPattern: parseResult.data.forbiddenPattern,
        allowException: parseResult.data.allowException,
        active: parseResult.data.active,
        priority: parseResult.data.priority
      }
    });

    return reply.status(201).send({
      rule: createdRule
    });
  });
};

export default policyRoutes;
