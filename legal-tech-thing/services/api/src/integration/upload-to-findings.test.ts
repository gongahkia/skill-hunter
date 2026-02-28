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

type ClauseRow = {
  id: string;
  contractVersionId: string;
  type: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
  sourceParser: string;
  parserConfidence: number;
  createdAt: Date;
};

type PolicyProfileRow = {
  id: string;
  userId: string;
  defaultProvider: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OLLAMA";
  riskThresholds: Record<string, unknown>;
  createdAt: Date;
};

type PolicyRuleRow = {
  id: string;
  profileId: string;
  clauseRequirement: string | null;
  clauseSelector: string;
  requiredPattern: string | null;
  forbiddenPattern: string | null;
  allowException: boolean;
  active: boolean;
  priority: number;
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
  const clauses: ClauseRow[] = [];
  const profiles: PolicyProfileRow[] = [];
  const policyRules: PolicyRuleRow[] = [];
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
    clause: {
      async findMany(args: {
        where?: {
          contractVersionId?: string;
        };
      }) {
        const contractVersionId = args.where?.contractVersionId;
        const filtered = clauses.filter((clause) =>
          contractVersionId ? clause.contractVersionId === contractVersionId : true
        );

        return filtered.sort((left, right) => left.startOffset - right.startOffset);
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
    policyRule: {
      async findMany(args: {
        where?: {
          profileId?: string;
          active?: boolean;
        };
      }) {
        const where = args.where ?? {};
        return policyRules
          .filter((rule) => {
            if (where.profileId && rule.profileId !== where.profileId) {
              return false;
            }
            if (where.active !== undefined && rule.active !== where.active) {
              return false;
            }
            return true;
          })
          .sort((left, right) => left.priority - right.priority);
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
      },
      async findFirst(args: {
        where?: {
          id?: string;
          contractVersion?: {
            contract?: {
              ownerId?: string;
            };
          };
        };
      }) {
        const where = args.where ?? {};

        return (
          reviewRuns.find((reviewRun) => {
            if (where.id && reviewRun.id !== where.id) {
              return false;
            }

            if (where.contractVersion?.contract?.ownerId) {
              const version = versions.find((item) => item.id === reviewRun.contractVersionId);
              const contract = version
                ? contracts.find((item) => item.id === version.contractId)
                : null;
              if (!contract || contract.ownerId !== where.contractVersion.contract.ownerId) {
                return false;
              }
            }

            return true;
          }) ?? null
        );
      }
    },
    finding: {
      async findMany(args: {
        where?: {
          contractVersionId?: string;
          contractVersion?: {
            contractId?: string;
          };
          severity?: FindingRow["severity"];
          status?: FindingRow["status"];
        };
      }) {
        const where = args.where ?? {};
        const contractIdFilter = where.contractVersion?.contractId;
        const contractVersionIdFilter = where.contractVersionId;

        const filtered = findings.filter((finding) => {
          if (contractVersionIdFilter && finding.contractVersionId !== contractVersionIdFilter) {
            return false;
          }

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
    },
    reviewFeedback: {
      async findMany() {
        return [];
      }
    }
  };

  const queues = {
    contractIngestionQueue: {
      async add(_name: string, data?: { contractVersionId?: string }) {
        if (data?.contractVersionId) {
          clauses.push({
            id: randomUUID(),
            contractVersionId: data.contractVersionId,
            type: "UNKNOWN",
            normalizedText:
              "The provider may terminate at any time and liability shall not be limited.",
            startOffset: 0,
            endOffset: 75,
            sourceParser: "text",
            parserConfidence: 0.88,
            createdAt: new Date()
          });
        }

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

  it("exports a review artifact containing findings and evidence payloads", async (t) => {
    const app = await buildIntegrationApp();
    t.after(async () => {
      await app.close();
    });

    const createContractResponse = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        title: "Exportable Review Contract",
        sourceType: "UPLOAD"
      }
    });
    assert.equal(createContractResponse.statusCode, 201);
    const contractId = createContractResponse.json().contract.id as string;

    const uploadUrlResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/upload-url`,
      payload: {
        fileName: "exportable.txt",
        mimeType: "text/plain",
        contentLength: 160
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
        contentLength: 160,
        checksum: "exportable-checksum"
      }
    });
    assert.equal(ingestResponse.statusCode, 202);
    const contractVersionId = ingestResponse.json().contractVersion.id as string;

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/reviews",
      payload: {
        contractVersionId
      }
    });
    assert.equal(reviewResponse.statusCode, 202);
    const reviewRunId = reviewResponse.json().reviewRun.id as string;

    const exportResponse = await app.inject({
      method: "GET",
      url: `/reviews/${reviewRunId}/export`
    });
    assert.equal(exportResponse.statusCode, 200);
    const exportBody = exportResponse.json();

    assert.equal(exportBody.fileName, `review-export-${reviewRunId}.json`);
    assert.equal(exportBody.artifact.reviewRun.id, reviewRunId);
    assert.equal(exportBody.artifact.reviewRun.contractVersionId, contractVersionId);
    assert.equal(exportBody.artifact.summary.totalFindings, 1);
    assert.equal(exportBody.artifact.summary.bySeverity.HIGH, 1);
    assert.equal(exportBody.artifact.summary.byStatus.OPEN, 1);
    assert.equal(exportBody.artifact.findings.length, 1);
    assert.equal(exportBody.artifact.findings[0].title, "Auto-generated risk finding");
    assert.equal(
      exportBody.artifact.findings[0].evidence.excerpt,
      "Sample risky language excerpt."
    );
    assert.equal(typeof exportBody.artifact.findings[0].confidence, "number");
  });

  it("runs comparison mode across two providers and returns finding deltas", async (t) => {
    const app = await buildIntegrationApp();
    t.after(async () => {
      await app.close();
    });

    const createContractResponse = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        title: "Comparison Test Contract",
        sourceType: "UPLOAD"
      }
    });
    assert.equal(createContractResponse.statusCode, 201);
    const contractId = createContractResponse.json().contract.id as string;

    const uploadUrlResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/upload-url`,
      payload: {
        fileName: "comparison.txt",
        mimeType: "text/plain",
        contentLength: 256
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
        contentLength: 256,
        checksum: "comparison-checksum"
      }
    });
    assert.equal(ingestResponse.statusCode, 202);
    const contractVersionId = ingestResponse.json().contractVersion.id as string;

    const compareResponse = await app.inject({
      method: "POST",
      url: "/reviews/compare",
      payload: {
        contractVersionId,
        primaryProvider: "OPENAI",
        comparisonProvider: "ANTHROPIC"
      }
    });
    assert.equal(compareResponse.statusCode, 200);
    const compareBody = compareResponse.json();

    assert.equal(compareBody.providers.primary, "OPENAI");
    assert.equal(compareBody.providers.comparison, "ANTHROPIC");
    assert.ok(compareBody.counts.primary >= 1);
    assert.equal(compareBody.counts.introduced, 0);
    assert.equal(compareBody.counts.resolved, 0);
    assert.equal(compareBody.counts.changed, 0);
    assert.equal(compareBody.counts.unchanged, compareBody.counts.primary);
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

  it("accepts desktop OCR screenshot payload submissions through upload and ingest endpoints", async (t) => {
    const app = await buildIntegrationApp();
    t.after(async () => {
      await app.close();
    });

    const mockedOcrPayload = [
      "SERVICE AGREEMENT",
      "Customer must provide 90 days notice before termination.",
      "Liability is uncapped for all indirect damages."
    ].join("\\n\\n");
    const contentLength = new TextEncoder().encode(mockedOcrPayload).byteLength;

    const createContractResponse = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        title: "Desktop OCR Capture",
        sourceType: "DESKTOP_SCREEN"
      }
    });
    assert.equal(createContractResponse.statusCode, 201);
    const createContractBody = createContractResponse.json();
    const contractId = createContractBody.contract.id as string;
    assert.equal(createContractBody.contract.sourceType, "DESKTOP_SCREEN");

    const uploadUrlResponse = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/upload-url`,
      payload: {
        fileName: "desktop-ocr-capture.txt",
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
        checksum: "desktop-ocr-checksum"
      }
    });
    assert.equal(ingestResponse.statusCode, 202);
    const ingestBody = ingestResponse.json();
    assert.ok(ingestBody.queueJobId);
    assert.ok(ingestBody.contractVersion.id);
  });
});
