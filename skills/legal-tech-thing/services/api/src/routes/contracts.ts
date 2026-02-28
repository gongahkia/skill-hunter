import { ContractSourceType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createContractBodySchema = z.object({
  title: z.string().min(1).max(255),
  sourceType: z.nativeEnum(ContractSourceType)
});

const contractRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parseResult = createContractBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const contract = await app.prisma.contract.create({
      data: {
        ownerId: request.auth.userId,
        title: parseResult.data.title.trim(),
        sourceType: parseResult.data.sourceType
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        sourceType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return reply.status(201).send({
      contract,
      uploadInstructions: {
        nextEndpoint: `/contracts/${contract.id}/upload-url`,
        method: "POST",
        requiredFields: ["fileName", "mimeType", "contentLength"]
      }
    });
  });

  app.get("/", async (request) => {
    const contracts = await app.prisma.contract.findMany({
      where: {
        ownerId: request.auth.userId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      items: contracts
    };
  });
};

export default contractRoutes;
