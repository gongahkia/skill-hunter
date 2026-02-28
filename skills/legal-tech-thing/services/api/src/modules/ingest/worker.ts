import { ContractProcessingStatus, PrismaClient } from "@prisma/client";

import { cleanContractText } from "./clean-text";
import { classifyClauseType } from "./clause-classifier";
import { segmentContractClauses } from "./clause-segmentation";
import { detectContractLanguage } from "./language";
import { parseContractByMimeType } from "./parser-router";
import type { ContractIngestionJobPayload } from "./types";
import {
  closeEmbeddingsQueue,
  enqueueClauseEmbeddingJob
} from "../embeddings/queue";

const prisma = new PrismaClient();
const parserConfidenceByParser = {
  html: 0.95,
  pdf: 0.9,
  docx: 0.92,
  image: 0.72,
  text: 0.88
} as const;

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

  const typedClauses = segmentedClauses.map((clause) => ({
    ...clause,
    type: classifyClauseType(clause)
  }));
  const parserConfidence =
    parserConfidenceByParser[parsedDocument.parser] ??
    parserConfidenceByParser.text;

  await prisma.$transaction(async (tx) => {
    await tx.clause.deleteMany({
      where: {
        contractVersionId: payload.contractVersionId
      }
    });

    if (typedClauses.length > 0) {
      await tx.clause.createMany({
        data: typedClauses.map((clause) => ({
          contractVersionId: payload.contractVersionId,
          type: clause.type,
          normalizedText: clause.text,
          startOffset: clause.startOffset,
          endOffset: clause.endOffset,
          sourceParser: parsedDocument.parser,
          parserConfidence
        }))
      });
    }
  });
  await enqueueClauseEmbeddingJob({
    requestId: payload.requestId,
    contractVersionId: payload.contractVersionId
  });

  console.log("Detected contract language", {
    requestId: payload.requestId,
    contractId: payload.contractId,
    contractVersionId: payload.contractVersionId,
    iso6393: detectedLanguage.iso6393,
    iso6391: detectedLanguage.iso6391,
    languageName: detectedLanguage.languageName,
    segmentedClauseCount: segmentedClauses.length,
    classifiedClauseCount: typedClauses.length,
    parserConfidence
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
  await closeEmbeddingsQueue();
  await prisma.$disconnect();
}
