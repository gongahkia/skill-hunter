import { ContractProcessingStatus, PrismaClient } from "@prisma/client";

import { cleanContractText } from "./clean-text";
import { segmentContractClauses } from "./clause-segmentation";
import { detectContractLanguage } from "./language";
import { parseContractByMimeType } from "./parser-router";
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

  // Source retrieval is wired in a subsequent task; parser routing is available now.
  const parsedDocument = await parseContractByMimeType(payload.mimeType, Buffer.from(""));
  const cleanedText = cleanContractText(parsedDocument.text);
  const detectedLanguage = detectContractLanguage(cleanedText);
  const segmentedClauses = segmentContractClauses(cleanedText);

  console.log("Detected contract language", {
    contractId: payload.contractId,
    contractVersionId: payload.contractVersionId,
    iso6393: detectedLanguage.iso6393,
    iso6391: detectedLanguage.iso6391,
    languageName: detectedLanguage.languageName,
    segmentedClauseCount: segmentedClauses.length
  });

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
