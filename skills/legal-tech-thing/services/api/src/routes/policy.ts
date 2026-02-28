import { LlmProvider } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

const defaultRiskThresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
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
          riskThresholds: defaultRiskThresholds
        }
      });
    }

    return reply.status(200).send({
      profile
    });
  });
};

export default policyRoutes;
