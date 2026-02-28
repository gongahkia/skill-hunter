import { FindingSeverity, FindingStatus, PrismaClient } from "@prisma/client";

import type { CanonicalFinding } from "../agents/normalize-findings";

const prisma = new PrismaClient();

function toFindingSeverity(value: CanonicalFinding["severity"]) {
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

  return FindingSeverity.INFO;
}

export async function persistAnchoredFindings(findings: CanonicalFinding[]) {
  const createdFindings = [] as Array<{
    findingId: string;
    evidenceSpanId: string;
    canonicalKey: string;
  }>;

  for (const finding of findings) {
    const primaryEvidence = finding.evidence[0] ?? {
      clauseId: null,
      startOffset: 0,
      endOffset: 0,
      excerpt: ""
    };

    const createdEvidenceSpan = await prisma.evidenceSpan.create({
      data: {
        contractVersionId: finding.contractVersionId,
        startOffset: primaryEvidence.startOffset,
        endOffset: primaryEvidence.endOffset,
        excerpt: primaryEvidence.excerpt,
        pageNumber: null
      },
      select: {
        id: true
      }
    });

    const createdFinding = await prisma.finding.create({
      data: {
        contractVersionId: finding.contractVersionId,
        clauseId: primaryEvidence.clauseId,
        evidenceSpanId: createdEvidenceSpan.id,
        title: finding.title,
        description: finding.description,
        severity: toFindingSeverity(finding.severity),
        confidence: finding.confidence,
        status: FindingStatus.OPEN
      },
      select: {
        id: true
      }
    });

    createdFindings.push({
      findingId: createdFinding.id,
      evidenceSpanId: createdEvidenceSpan.id,
      canonicalKey: finding.canonicalKey
    });
  }

  return createdFindings;
}

export async function closeEvidenceAnchoringResources() {
  await prisma.$disconnect();
}
