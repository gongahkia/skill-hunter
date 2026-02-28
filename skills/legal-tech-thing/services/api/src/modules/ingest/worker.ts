import { ContractProcessingStatus, PrismaClient } from "@prisma/client";

import type { ContractIngestionJobPayload } from "./types";

const prisma = new PrismaClient();

export async function processContractIngestionJob(
  payload: ContractIngestionJobPayload
) {
  await prisma.contract.update({
    where: {
      id: payload.contractId
    },
    data: {
      status: ContractProcessingStatus.INGESTING
    }
  });

  // Normalization steps are added incrementally in subsequent tasks.
  await prisma.contract.update({
    where: {
      id: payload.contractId
    },
    data: {
      status: ContractProcessingStatus.READY
    }
  });
}

export async function failContractIngestionJob(contractId: string) {
  await prisma.contract.update({
    where: {
      id: contractId
    },
    data: {
      status: ContractProcessingStatus.FAILED
    }
  });
}

export async function closeIngestionWorkerResources() {
  await prisma.$disconnect();
}
