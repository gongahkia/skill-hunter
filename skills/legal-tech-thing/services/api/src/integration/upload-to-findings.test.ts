import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import Fastify from "fastify";

import rbacPlugin from "../plugins/rbac";
import validationPlugin from "../plugins/validation";
import contractRoutes from "../routes/contracts";
import reviewRoutes from "../routes/reviews";

type ContractRow = {
  id: string;
  ownerId: string;
  title: string;
  sourceType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type ContractVersionRow = {
  id: string;
  contractId: string;
  checksum: string;
  storageUri: string;
  createdAt: Date;
};

type PolicyProfileRow = {
  id: string;
  userId: string;
  defaultProvider: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OLLAMA";
  riskThresholds: Record<string, unknown>;
  createdAt: Date;
};

type ReviewRunRow = {
  id: string;
  contractVersionId: string;
  profileId: string;
  provider: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OLLAMA";
  providerModel: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  orchestrationMeta: Record<string, unknown>;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EvidenceSpanRow = {
  id: string;
  contractVersionId: string;
  startOffset: number;
  endOffset: number;
  excerpt: string;
  pageNumber: number | null;
  createdAt: Date;
};

type FindingRow = {
  id: string;
  contractVersionId: string;
  clauseId: string | null;
  evidenceSpanId: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  confidence: number;
  status: "OPEN" | "ACCEPTED" | "DISMISSED" | "NEEDS_EDIT";
  createdAt: Date;
  updatedAt: Date;
};

function createInMemoryPrisma(userId: string) {
  const contracts: ContractRow[] = [];
  const versions: ContractVersionRow[] = [];
  const profiles: PolicyProfileRow[] = [];
  const reviewRuns: ReviewRunRow[] = [];
  const evidenceSpans: EvidenceSpanRow[] = [];
  const findings: FindingRow[] = [];

  const prisma = {
    contract: {
      async create(args: {
        data: {
          ownerId: string;
          title: string;
          sourceType: string;
        };
      }) {
        const now = new Date();
        const contract: ContractRow = {
          id: randomUUID(),
          ownerId: args.data.ownerId,
          title: args.data.title,
          sourceType: args.data.sourceType,
          status: "CREATED",
          createdAt: now,
          updatedAt: now
        };
        contracts.push(contract);
        return contract;
      },
      async findFirst(args: {
        where?: {
          id?: string;
          ownerId?: string;
        };
      }) {
        const where = args.where ?? {};
        return (
          contracts.find((contract) => {
            if (where.id && contract.id !== where.id) {
              return false;
            }

            if (where.ownerId && contract.ownerId !== where.ownerId) {
              return false;
            }

            return true;
          }) ?? null
        );
      },
      async update(args: {
        where: {
          id: string;
        };
        data: Partial<ContractRow>;
      }) {
        const contract = contracts.find((item) => item.id === args.where.id);
        if (!contract) {
          throw new Error("CONTRACT_NOT_FOUND");
        }

        Object.assign(contract, args.data, { updatedAt: new Date() });
        return contract;
      }
    },
    contractVersion: {
      async create(args: {
        data: {
          contractId: string;
          checksum: string;
          storageUri: string;
        };
      }) {
        const version: ContractVersionRow = {
          id: randomUUID(),
          contractId: args.data.contractId,
          checksum: args.data.checksum,
          storageUri: args.data.storageUri,
          createdAt: new Date()
        };

        versions.push(version);
        return version;
      },
      async findFirst(args: {
        where?: {
          id?: string;
          contractId?: string;
          checksum?: string;
          contract?: {
            ownerId?: string;
          };
        };
      }) {
        const where = args.where ?? {};

        return (
          versions.find((version) => {
            if (where.id && version.id !== where.id) {
              return false;
            }

            if (where.contractId && version.contractId !== where.contractId) {
              return false;
            }

            if (where.checksum && version.checksum !== where.checksum) {
              return false;
            }

            if (where.contract?.ownerId) {
              const contract = contracts.find((item) => item.id === version.contractId);
              if (!contract || contract.ownerId !== where.contract.ownerId) {
                return false;
              }
            }

            return true;
          }) ?? null
        );
      }
    },
    policyProfile: {
      async findFirst(args: {
        where?: {
          id?: string;
          userId?: string;
        };
      }) {
        const where = args.where ?? {};

        return (
          profiles.find((profile) => {
            if (where.id && profile.id !== where.id) {
              return false;
            }

            if (where.userId && profile.userId !== where.userId) {
              return false;
            }

            return true;
          }) ?? null
        );
      },
      async create(args: {
        data: {
          userId: string;
          defaultProvider: PolicyProfileRow["defaultProvider"];
          riskThresholds: Record<string, unknown>;
        };
      }) {
        const profile: PolicyProfileRow = {
          id: randomUUID(),
          userId: args.data.userId,
          defaultProvider: args.data.defaultProvider,
          riskThresholds: args.data.riskThresholds,
          createdAt: new Date()
        };

        profiles.push(profile);
        return profile;
      }
    },
    reviewRun: {
      async create(args: {
        data: {
          contractVersionId: string;
          profileId: string;
          provider: ReviewRunRow["provider"];
          providerModel: string;
          status: ReviewRunRow["status"];
          orchestrationMeta: Record<string, unknown>;
        };
      }) {
        const now = new Date();
        const reviewRun: ReviewRunRow = {
          id: randomUUID(),
          contractVersionId: args.data.contractVersionId,
          profileId: args.data.profileId,
          provider: args.data.provider,
          providerModel: args.data.providerModel,
          status: args.data.status,
          orchestrationMeta: args.data.orchestrationMeta,
          startedAt: null,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
          createdAt: now,
          updatedAt: now
        };

        reviewRuns.push(reviewRun);
        return reviewRun;
      }
    },
    finding: {
      async findMany(args: {
        where?: {
          contractVersion?: {
            contractId?: string;
          };
          severity?: FindingRow["severity"];
          status?: FindingRow["status"];
        };
      }) {
        const where = args.where ?? {};
        const contractIdFilter = where.contractVersion?.contractId;

        const filtered = findings.filter((finding) => {
          if (contractIdFilter) {
            const version = versions.find((item) => item.id === finding.contractVersionId);
            if (!version || version.contractId !== contractIdFilter) {
              return false;
            }
          }

          if (where.severity && finding.severity !== where.severity) {
            return false;
          }

          if (where.status && finding.status !== where.status) {
            return false;
          }

          return true;
        });

        return filtered
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map((finding) => ({
            ...finding,
            evidenceSpan: evidenceSpans.find((span) => span.id === finding.evidenceSpanId) ?? null
          }));
      }
    }
  };

  const queues = {
    contractIngestionQueue: {
      async add(_name: string) {
        return {
          id: `ingest-${randomUUID()}`
        };
      }
    },
    reviewRunQueue: {
      async add(_name: string, data: { contractVersionId: string }) {
        const evidenceSpan: EvidenceSpanRow = {
          id: randomUUID(),
          contractVersionId: data.contractVersionId,
          startOffset: 0,
          endOffset: 64,
          excerpt: "Sample risky language excerpt.",
          pageNumber: null,
          createdAt: new Date()
        };
        evidenceSpans.push(evidenceSpan);

        findings.push({
          id: randomUUID(),
          contractVersionId: data.contractVersionId,
          clauseId: null,
          evidenceSpanId: evidenceSpan.id,
          title: "Auto-generated risk finding",
          description: "Potentially risky clause found.",
          severity: "HIGH",
          confidence: 0.88,
          status: "OPEN",
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return {
          id: `review-${randomUUID()}`
        };
      }
    }
  };

  const objectStorage = {
    bucket: "legal-tech-artifacts",
    async createPresignedUploadUrl() {
      return {
        uploadUrl: "https://storage.example/upload",
        expiresInSeconds: 600
      };
    },
    async createPresignedDownloadUrl() {
      return {
        downloadUrl: "https://storage.example/download",
        expiresInSeconds: 300
      };
    },
    async getObject() {
      return {};
    },
    async putObject() {
      return "legal-tech-artifacts/contracts/mock";
    },
    async deleteObject() {
      return;
    }
  };

  const redisValues = new Map<string, string>();

  const redis = {
    async get(key: string) {
      return redisValues.get(key) ?? null;
    },
    async set(key: string, value: string, ...args: Array<string | number>) {
      const hasNx = args.includes("NX");
      if (hasNx && redisValues.has(key)) {
        return null;
      }

      redisValues.set(key, value);
      return "OK";
    },
    async del(key: string) {
      redisValues.delete(key);
      return 1;
    }
  };

  return {
    prisma,
    queues,
    objectStorage,
    redis,
    userId
  };
}

async function buildIntegrationApp() {
  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const deps = createInMemoryPrisma(userId);
  const app = Fastify();

  app.decorate("prisma", deps.prisma as never);
  app.decorate("queues", deps.queues as never);
  app.decorate("objectStorage", deps.objectStorage as never);
  app.decorate("redis", deps.redis as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      sessionId: "session-1"
    };
  });

  await app.register(validationPlugin);
  await app.register(rbacPlugin);
  await app.register(contractRoutes, { prefix: "/contracts" });
  await app.register(reviewRoutes, { prefix: "/reviews" });

  return app;
}

describe("upload to findings integration flow", () => {
  it("creates a contract, ingests a version, runs review, and retrieves findings", async (t) => {
    const app = await buildIntegrationApp();
    t.after(async () => {
      await app.close();
    });

    const createContractResponse = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        title: "Master Services Agreement",
        sourceType: "UPLOAD"
      }
    });
    assert.equal(createContractResponse.statusCode, 201);
    const createContractBody = createContractResponse.json();
    const contractId = createContractBody.contract.id as string;

    const uploadUrlResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/upload-url`,
      payload: {
        fileName: "msa.txt",
        mimeType: "text/plain",
        contentLength: 128
      }
    });
    assert.equal(uploadUrlResponse.statusCode, 200);
    const uploadUrlBody = uploadUrlResponse.json();

    const ingestResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/ingest`,
      payload: {
        objectUri: uploadUrlBody.objectUri,
        objectKey: uploadUrlBody.objectKey,
        mimeType: "text/plain",
        contentLength: 128,
        checksum: "abc123"
      }
    });
    assert.equal(ingestResponse.statusCode, 202);
    const ingestBody = ingestResponse.json();

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/reviews",
      payload: {
        contractVersionId: ingestBody.contractVersion.id
      }
    });
    assert.equal(reviewResponse.statusCode, 202);

    const findingsResponse = await app.inject({
      method: "GET",
      url: `/contracts/${contractId}/findings`
    });
    assert.equal(findingsResponse.statusCode, 200);

    const findingsBody = findingsResponse.json();
    assert.equal(findingsBody.items.length, 1);
    assert.equal(findingsBody.items[0].title, "Auto-generated risk finding");
    assert.equal(findingsBody.items[0].severity, "HIGH");
    assert.equal(findingsBody.items[0].status, "OPEN");
    assert.equal(findingsBody.items[0].evidenceSpan?.excerpt, "Sample risky language excerpt.");
  });

  it("accepts extension-style DOM payload submissions through upload and ingest endpoints", async (t) => {
    const app = await buildIntegrationApp();
    t.after(async () => {
      await app.close();
    });

    const mockedDomPayload = [
      "Terms of Service",
      "By clicking Accept, you agree to binding arbitration.",
      "We may update these terms at any time."
    ].join("\\n\\n");
    const contentLength = new TextEncoder().encode(mockedDomPayload).byteLength;

    const createContractResponse = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        title: "Site Terms (Mock DOM)",
        sourceType: "EXTENSION_DOM"
      }
    });
    assert.equal(createContractResponse.statusCode, 201);
    const createContractBody = createContractResponse.json();
    const contractId = createContractBody.contract.id as string;
    assert.equal(createContractBody.contract.sourceType, "EXTENSION_DOM");

    const uploadUrlResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/upload-url`,
      payload: {
        fileName: "mock-dom-capture.txt",
        mimeType: "text/plain; charset=utf-8",
        contentLength
      }
    });
    assert.equal(uploadUrlResponse.statusCode, 200);
    const uploadUrlBody = uploadUrlResponse.json();

    const ingestResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/ingest`,
      payload: {
        objectUri: uploadUrlBody.objectUri,
        objectKey: uploadUrlBody.objectKey,
        mimeType: "text/plain; charset=utf-8",
        contentLength,
        checksum: "dom-payload-checksum"
      }
    });
    assert.equal(ingestResponse.statusCode, 202);
    const ingestBody = ingestResponse.json();
    assert.ok(ingestBody.queueJobId);
    assert.ok(ingestBody.contractVersion.id);
  });
});
