import {
  ContractSourceType,
  ContractProcessingStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createContractBodySchema = z.object({
  title: z.string().min(1).max(255),
  sourceType: z.nativeEnum(ContractSourceType)
});

const contractIdParamsSchema = z.object({
  id: z.string().uuid()
});

const uploadUrlBodySchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  contentLength: z.number().int().positive().max(100 * 1024 * 1024)
});

const ingestBodySchema = z.object({
  objectUri: z.string().min(1),
  objectKey: z.string().min(1),
  mimeType: z.string().min(1).max(255),
  contentLength: z.number().int().positive().max(100 * 1024 * 1024),
  checksum: z.string().min(1)
});

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName);
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

  app.post("/:id/upload-url", async (request, reply) => {
    const paramsResult = contractIdParamsSchema.safeParse(request.params);
    const bodyResult = uploadUrlBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: {
          params: paramsResult.success ? null : paramsResult.error.flatten(),
          body: bodyResult.success ? null : bodyResult.error.flatten()
        }
      });
    }

    const contract = await app.prisma.contract.findFirst({
      where: {
        id: paramsResult.data.id,
        ownerId: request.auth.userId
      },
      select: {
        id: true
      }
    });

    if (!contract) {
      return reply.status(404).send({
        error: "CONTRACT_NOT_FOUND"
      });
    }

    const safeFileName = sanitizeFileName(bodyResult.data.fileName);
    const objectKey = `contracts/${contract.id}/sources/${randomUUID()}-${safeFileName}`;

    const upload = await app.objectStorage.createPresignedUploadUrl({
      key: objectKey,
      contentType: bodyResult.data.mimeType
    });

    await app.prisma.contract.update({
      where: {
        id: contract.id
      },
      data: {
        status: ContractProcessingStatus.UPLOADING
      }
    });

    return reply.status(200).send({
      uploadUrl: upload.uploadUrl,
      objectUri: `${app.objectStorage.bucket}/${objectKey}`,
      objectKey,
      expiresInSeconds: upload.expiresInSeconds,
      expectedContentLength: bodyResult.data.contentLength,
      expectedContentType: bodyResult.data.mimeType
    });
  });

  app.post("/:id/ingest", async (request, reply) => {
    const paramsResult = contractIdParamsSchema.safeParse(request.params);
    const bodyResult = ingestBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: {
          params: paramsResult.success ? null : paramsResult.error.flatten(),
          body: bodyResult.success ? null : bodyResult.error.flatten()
        }
      });
    }

    const contract = await app.prisma.contract.findFirst({
      where: {
        id: paramsResult.data.id,
        ownerId: request.auth.userId
      },
      select: {
        id: true,
        ownerId: true,
        sourceType: true
      }
    });

    if (!contract) {
      return reply.status(404).send({
        error: "CONTRACT_NOT_FOUND"
      });
    }

    const contractVersion = await app.prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        checksum: bodyResult.data.checksum,
        storageUri: bodyResult.data.objectUri
      },
      select: {
        id: true,
        contractId: true,
        checksum: true,
        storageUri: true,
        createdAt: true
      }
    });

    const job = await app.queues.contractIngestionQueue.add(
      `contract-ingest:${contract.id}:${contractVersion.id}`,
      {
        contractId: contract.id,
        contractVersionId: contractVersion.id,
        ownerId: contract.ownerId,
        objectUri: bodyResult.data.objectUri,
        objectKey: bodyResult.data.objectKey,
        mimeType: bodyResult.data.mimeType,
        contentLength: bodyResult.data.contentLength,
        sourceType: contract.sourceType
      }
    );

    await app.prisma.contract.update({
      where: {
        id: contract.id
      },
      data: {
        status: ContractProcessingStatus.QUEUED
      }
    });

    return reply.status(202).send({
      queued: true,
      queueJobId: job.id,
      contractVersion
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
