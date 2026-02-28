import {
  contractFindingsQuerySchema,
  contractIdParamsSchema,
  contractSourceDownloadQuerySchema,
  contractVersionDiffQuerySchema,
  createContractBodySchema,
  createUploadUrlBodySchema,
  ingestContractBodySchema
} from "@legal-tech/shared-types";
import {
  ContractSourceType,
  ContractProcessingStatus,
  FindingSeverity,
  FindingStatus,
  Prisma
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";

import { diffContractVersions } from "../modules/contracts/version-diff";

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

function normalizeChecksum(checksum: string) {
  const trimmed = checksum.trim();
  const withoutPrefix = trimmed.replace(/^sha256:/i, "");
  const isHex = /^[a-fA-F0-9]+$/.test(withoutPrefix);
  return isHex ? withoutPrefix.toLowerCase() : withoutPrefix;
}

function buildContractFingerprint(input: {
  checksum: string;
  mimeType: string;
  contentLength: number;
}) {
  const normalizedPayload = {
    checksum: normalizeChecksum(input.checksum),
    mimeType: input.mimeType.trim().toLowerCase(),
    contentLength: input.contentLength
  };

  return createHash("sha256")
    .update(JSON.stringify(normalizedPayload))
    .digest("hex");
}

function getObjectKeyFromStorageUri(storageUri: string, bucket: string) {
  const prefix = `${bucket}/`;
  if (!storageUri.startsWith(prefix)) {
    return null;
  }

  const key = storageUri.slice(prefix.length);
  return key.length > 0 ? key : null;
}

function isOwnedSourceObjectKey(contractId: string, objectKey: string) {
  return objectKey.startsWith(`contracts/${contractId}/sources/`);
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
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema,
          body: createUploadUrlBodySchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const body = request.validated.body as {
        fileName: string;
        mimeType: string;
        contentLength: number;
      };
      const contract = request.contractAccess;

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
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema,
          body: ingestContractBodySchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const body = request.validated.body as {
        objectUri: string;
        objectKey: string;
        mimeType: string;
        contentLength: number;
        checksum: string;
      };
      const fingerprint = buildContractFingerprint({
        checksum: body.checksum,
        mimeType: body.mimeType,
        contentLength: body.contentLength
      });
      const contract = request.contractAccess;

      if (!contract) {
        return reply.status(404).send({
          error: "CONTRACT_NOT_FOUND"
        });
      }

      const existingVersion = await app.prisma.contractVersion.findFirst({
        where: {
          contractId: contract.id,
          checksum: fingerprint
        },
        select: {
          id: true,
          contractId: true,
          checksum: true,
          storageUri: true,
          createdAt: true
        }
      });

      if (existingVersion) {
        return reply.status(200).send({
          queued: false,
          deduplicated: true,
          queueJobId: existingVersion.id,
          contractVersion: existingVersion
        });
      }

      let contractVersion: {
        id: string;
        contractId: string;
        checksum: string;
        storageUri: string;
        createdAt: Date;
      };

      try {
        contractVersion = await app.prisma.contractVersion.create({
          data: {
            contractId: contract.id,
            checksum: fingerprint,
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
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const duplicatedVersion = await app.prisma.contractVersion.findFirst({
            where: {
              contractId: contract.id,
              checksum: fingerprint
            },
            select: {
              id: true,
              contractId: true,
              checksum: true,
              storageUri: true,
              createdAt: true
            }
          });

          if (duplicatedVersion) {
            return reply.status(200).send({
              queued: false,
              deduplicated: true,
              queueJobId: duplicatedVersion.id,
              contractVersion: duplicatedVersion
            });
          }
        }

        throw error;
      }

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
    "/:id/source-download-url",
    {
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema,
          query: contractSourceDownloadQuerySchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const query = request.validated.query as {
        versionId?: string;
      };
      const contract = request.contractAccess;

      if (!contract) {
        return reply.status(404).send({
          error: "CONTRACT_NOT_FOUND"
        });
      }

      const contractVersion = await app.prisma.contractVersion.findFirst({
        where: query.versionId
          ? {
              id: query.versionId,
              contractId: contract.id
            }
          : {
              contractId: contract.id
            },
        orderBy: query.versionId
          ? undefined
          : {
              createdAt: "desc"
            },
        select: {
          id: true,
          storageUri: true,
          createdAt: true
        }
      });

      if (!contractVersion) {
        return reply.status(404).send({
          error: "CONTRACT_VERSION_NOT_FOUND"
        });
      }

      const objectKey = getObjectKeyFromStorageUri(
        contractVersion.storageUri,
        app.objectStorage.bucket
      );

      if (!objectKey || !isOwnedSourceObjectKey(contract.id, objectKey)) {
        return reply.status(400).send({
          error: "CONTRACT_SOURCE_URI_INVALID"
        });
      }

      const download = await app.objectStorage.createPresignedDownloadUrl({
        key: objectKey
      });

      return reply.status(200).send({
        contractVersionId: contractVersion.id,
        downloadUrl: download.downloadUrl,
        expiresInSeconds: download.expiresInSeconds
      });
    });
  
  app.get(
    "/:id/versions/diff",
    {
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema,
          query: contractVersionDiffQuerySchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const query = request.validated.query as {
        fromVersionId?: string;
        toVersionId?: string;
      };
      const contract = request.contractAccess;

      if (!contract) {
        return reply.status(404).send({
          error: "CONTRACT_NOT_FOUND"
        });
      }

      const hasExplicitFromVersion = Boolean(query.fromVersionId);
      const hasExplicitToVersion = Boolean(query.toVersionId);
      if (hasExplicitFromVersion !== hasExplicitToVersion) {
        return reply.status(400).send({
          error: "CONTRACT_VERSION_DIFF_BOTH_IDS_REQUIRED"
        });
      }

      const versions = await app.prisma.contractVersion.findMany({
        where: {
          contractId: contract.id
        },
        orderBy: {
          createdAt: "desc"
        },
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
              endOffset: true
            }
          }
        }
      });

      const versionsById = new Map(versions.map((version) => [version.id, version]));
      const isExplicitSelection = hasExplicitFromVersion && hasExplicitToVersion;
      const fromVersion = query.fromVersionId
        ? versionsById.get(query.fromVersionId) ?? null
        : versions[1] ?? null;
      const toVersion = query.toVersionId
        ? versionsById.get(query.toVersionId) ?? null
        : versions[0] ?? null;

      if (!fromVersion || !toVersion) {
        return reply.status(isExplicitSelection ? 404 : 400).send({
          error: isExplicitSelection
            ? "CONTRACT_VERSION_NOT_FOUND"
            : "CONTRACT_VERSION_DIFF_REQUIRES_TWO_VERSIONS"
        });
      }

      if (fromVersion.id === toVersion.id) {
        return reply.status(400).send({
          error: "CONTRACT_VERSION_DIFF_IDENTICAL_VERSIONS"
        });
      }

      const diff = diffContractVersions(fromVersion.clauses, toVersion.clauses);

      return reply.status(200).send({
        contractId: contract.id,
        fromVersion: {
          id: fromVersion.id,
          createdAt: fromVersion.createdAt
        },
        toVersion: {
          id: toVersion.id,
          createdAt: toVersion.createdAt
        },
        diff
      });
    });
  

  app.get(
    "/:id",
    {
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const params = request.validated.params as {
        id: string;
      };

      const contract = await app.prisma.contract.findFirst({
        where: {
          id: params.id
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
      preHandler: [
        app.buildValidationPreHandler({
          params: contractIdParamsSchema,
          query: contractFindingsQuerySchema
        }),
        (request, reply) => app.rbac.requireOwnedContract(request, reply)
      ]
    },
    async (request, reply) => {
      const query = request.validated.query as {
        cursor?: string;
        limit: number;
        severity?: "critical" | "high" | "medium" | "low" | "info";
        status?: "open" | "accepted" | "dismissed" | "needs-edit";
      };
      const contract = request.contractAccess;

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
