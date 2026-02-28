import {
  contractFindingsQuerySchema,
  contractIdParamsSchema,
  createContractBodySchema,
  createUploadUrlBodySchema,
  ingestContractBodySchema
} from "@legal-tech/shared-types";
import {
  ContractSourceType,
  ContractProcessingStatus,
  FindingSeverity,
  FindingStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";

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
  app.post(
    "/",
    {
      preHandler: app.buildValidationPreHandler({
        body: createContractBodySchema
      })
    },
    async (request, reply) => {
      const body = request.validated.body as {
        title: string;
        sourceType: ContractSourceType;
      };

      const contract = await app.prisma.contract.create({
        data: {
          ownerId: request.auth.userId,
          title: body.title.trim(),
          sourceType: body.sourceType
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
  

  app.post(
    "/:id/upload-url",
    {
      preHandler: app.buildValidationPreHandler({
        params: contractIdParamsSchema,
        body: createUploadUrlBodySchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };
      const body = request.validated.body as {
        fileName: string;
        mimeType: string;
        contentLength: number;
      };

      const contract = await app.prisma.contract.findFirst({
        where: {
          id: params.id,
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

      const safeFileName = sanitizeFileName(body.fileName);
      const objectKey = `contracts/${contract.id}/sources/${randomUUID()}-${safeFileName}`;

      const upload = await app.objectStorage.createPresignedUploadUrl({
        key: objectKey,
        contentType: body.mimeType
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
        expectedContentLength: body.contentLength,
        expectedContentType: body.mimeType
      });
    });
  

  app.post(
    "/:id/ingest",
    {
      preHandler: app.buildValidationPreHandler({
        params: contractIdParamsSchema,
        body: ingestContractBodySchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };
      const body = request.validated.body as {
        objectUri: string;
        objectKey: string;
        mimeType: string;
        contentLength: number;
        checksum: string;
      };

      const contract = await app.prisma.contract.findFirst({
        where: {
          id: params.id,
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
          checksum: body.checksum,
          storageUri: body.objectUri
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
          requestId: request.id,
          contractId: contract.id,
          contractVersionId: contractVersion.id,
          ownerId: contract.ownerId,
          objectUri: body.objectUri,
          objectKey: body.objectKey,
          mimeType: body.mimeType,
          contentLength: body.contentLength,
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
  

  app.get(
    "/:id",
    {
      preHandler: app.buildValidationPreHandler({
        params: contractIdParamsSchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };

      const contract = await app.prisma.contract.findFirst({
        where: {
          id: params.id,
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
  

  app.get(
    "/:id/findings",
    {
      preHandler: app.buildValidationPreHandler({
        params: contractIdParamsSchema,
        query: contractFindingsQuerySchema
      })
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };
      const query = request.validated.query as {
        cursor?: string;
        limit: number;
        severity?: "critical" | "high" | "medium" | "low" | "info";
        status?: "open" | "accepted" | "dismissed" | "needs-edit";
      };

      const contract = await app.prisma.contract.findFirst({
        where: {
          id: params.id,
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

      const severityFilter = toFindingSeverity(query.severity);
      const statusFilter = toFindingStatus(query.status);
      const take = query.limit + 1;

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
        ...(query.cursor
          ? {
              cursor: {
                id: query.cursor
              },
              skip: 1
            }
          : {})
      });

      const hasNextPage = findings.length > query.limit;
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
