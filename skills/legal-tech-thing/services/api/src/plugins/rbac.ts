import {
  type ContractProcessingStatus,
  type ContractSourceType,
  type FindingStatus,
  type LlmProvider,
  type ReviewRunStatus
} from "@prisma/client";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

export type OwnedContract = {
  id: string;
  ownerId: string;
  title: string;
  sourceType: ContractSourceType;
  status: ContractProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type OwnedContractVersion = {
  id: string;
  contractId: string;
  checksum: string;
  storageUri: string;
  createdAt: Date;
};

export type OwnedReviewRun = {
  id: string;
  contractVersionId: string;
  profileId: string;
  provider: LlmProvider;
  providerModel: string;
  status: ReviewRunStatus;
  orchestrationMeta: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OwnedFinding = {
  id: string;
  status: FindingStatus;
};

declare module "fastify" {
  interface FastifyRequest {
    contractAccess?: OwnedContract;
  }

  interface FastifyInstance {
    rbac: {
      getOwnedContract: (contractId: string, userId: string) => Promise<OwnedContract | null>;
      requireOwnedContract: (
        request: FastifyRequest,
        reply: FastifyReply,
        options?: {
          paramKey?: string;
        }
      ) => Promise<void>;
      getOwnedContractVersion: (
        contractVersionId: string,
        userId: string
      ) => Promise<OwnedContractVersion | null>;
      getOwnedReviewRun: (reviewRunId: string, userId: string) => Promise<OwnedReviewRun | null>;
      getOwnedFinding: (findingId: string, userId: string) => Promise<OwnedFinding | null>;
    };
  }
}

const rbacPlugin = fp(async (app) => {
  const getOwnedContract = async (contractId: string, userId: string) => {
    return app.prisma.contract.findFirst({
      where: {
        id: contractId,
        ownerId: userId
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
  };

  const getOwnedContractVersion = async (contractVersionId: string, userId: string) => {
    return app.prisma.contractVersion.findFirst({
      where: {
        id: contractVersionId,
        contract: {
          ownerId: userId
        }
      },
      select: {
        id: true,
        contractId: true,
        checksum: true,
        storageUri: true,
        createdAt: true
      }
    });
  };

  const getOwnedReviewRun = async (reviewRunId: string, userId: string) => {
    return app.prisma.reviewRun.findFirst({
      where: {
        id: reviewRunId,
        contractVersion: {
          contract: {
            ownerId: userId
          }
        }
      },
      select: {
        id: true,
        contractVersionId: true,
        profileId: true,
        provider: true,
        providerModel: true,
        status: true,
        orchestrationMeta: true,
        startedAt: true,
        finishedAt: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true
      }
    });
  };

  const getOwnedFinding = async (findingId: string, userId: string) => {
    return app.prisma.finding.findFirst({
      where: {
        id: findingId,
        contractVersion: {
          contract: {
            ownerId: userId
          }
        }
      },
      select: {
        id: true,
        status: true
      }
    });
  };

  const requireOwnedContract = async (
    request: FastifyRequest,
    reply: FastifyReply,
    options: {
      paramKey?: string;
    } = {}
  ) => {
    const paramKey = options.paramKey ?? "id";
    const params = request.params as Record<string, unknown>;
    const contractId = params[paramKey];

    if (typeof contractId !== "string" || contractId.length === 0) {
      reply.status(400).send({
        error: "CONTRACT_ID_REQUIRED"
      });
      return;
    }

    const contract = await getOwnedContract(contractId, request.auth.userId);

    if (!contract) {
      reply.status(404).send({
        error: "CONTRACT_NOT_FOUND"
      });
      return;
    }

    request.contractAccess = contract;
  };

  app.decorate("rbac", {
    getOwnedContract,
    requireOwnedContract,
    getOwnedContractVersion,
    getOwnedReviewRun,
    getOwnedFinding
  });
});

export default rbacPlugin;
