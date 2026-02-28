import {
  ContractSourceType,
  ContractProcessingStatus,
  FindingSeverity,
  FindingStatus
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

const contractFindingsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  severity: z
    .enum(["critical", "high", "medium", "low", "info"])
    .optional(),
  status: z.enum(["open", "accepted", "dismissed", "needs-edit"]).optional()
});

function toFindingSeverity(value: string | undefined) {
  if (value === "critical") {
    return FindingSeverity.CRITICAL;
  }

  if (value === "high") {
    return FindingSeverity.HIGH;
  }

  if (value === "medium") {
    return FindingSeverity.MEDIUM;
  }

  if (value === "low") {
    return FindingSeverity.LOW;
  }

  if (value === "info") {
    return FindingSeverity.INFO;
  }

  return undefined;
}

function toFindingStatus(value: string | undefined) {
  if (value === "open") {
    return FindingStatus.OPEN;
  }

  if (value === "accepted") {
    return FindingStatus.ACCEPTED;
  }

  if (value === "dismissed") {
    return FindingStatus.DISMISSED;
  }

  if (value === "needs-edit") {
    return FindingStatus.NEEDS_EDIT;
  }

  return undefined;
}

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

  app.get("/:id", async (request, reply) => {
    const paramsResult = contractIdParamsSchema.safeParse(request.params);

    if (!paramsResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: paramsResult.error.flatten()
      });
    }

    const contract = await app.prisma.contract.findFirst({
      where: {
        id: paramsResult.data.id,
        ownerId: request.auth.userId
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            clauses: {
              orderBy: {
                startOffset: "asc"
              },
              select: {
                id: true,
                type: true,
                normalizedText: true,
                startOffset: true,
                endOffset: true,
                sourceParser: true,
                parserConfidence: true
              }
            }
          }
        }
      }
    });

    if (!contract) {
      return reply.status(404).send({
        error: "CONTRACT_NOT_FOUND"
      });
    }

    const latestVersion = contract.versions[0] ?? null;

    return reply.status(200).send({
      contract: {
        id: contract.id,
        title: contract.title,
        sourceType: contract.sourceType,
        status: contract.status,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt
      },
      latestVersion,
      clauses: latestVersion?.clauses ?? []
    });
  });

  app.get("/:id/findings", async (request, reply) => {
    const paramsResult = contractIdParamsSchema.safeParse(request.params);
    const queryResult = contractFindingsQuerySchema.safeParse(request.query);

    if (!paramsResult.success || !queryResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: {
          params: paramsResult.success ? null : paramsResult.error.flatten(),
          query: queryResult.success ? null : queryResult.error.flatten()
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

    const severityFilter = toFindingSeverity(queryResult.data.severity);
    const statusFilter = toFindingStatus(queryResult.data.status);
    const take = queryResult.data.limit + 1;

    const findings = await app.prisma.finding.findMany({
      where: {
        contractVersion: {
          contractId: contract.id
        },
        severity: severityFilter,
        status: statusFilter
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
      orderBy: {
        createdAt: "desc"
      },
      take,
      ...(queryResult.data.cursor
        ? {
            cursor: {
              id: queryResult.data.cursor
            },
            skip: 1
          }
        : {})
    });

    const hasNextPage = findings.length > queryResult.data.limit;
    const paginatedItems = hasNextPage ? findings.slice(0, -1) : findings;
    const lastItem = paginatedItems[paginatedItems.length - 1];

    return reply.status(200).send({
      items: paginatedItems,
      pagination: {
        nextCursor: hasNextPage && lastItem ? lastItem.id : null
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
        updatedAt: true,
        versions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            reviewRuns: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                createdAt: true
              }
            }
          }
        }
      }
    });

    return {
      items: contracts.map((contract) => ({
        id: contract.id,
        title: contract.title,
        sourceType: contract.sourceType,
        status: contract.status,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        lastReviewAt: contract.versions[0]?.reviewRuns[0]?.createdAt ?? null
      }))
    };
  });
};

export default contractRoutes;
