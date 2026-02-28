import { createHash } from "node:crypto";

import type { AgentName, AgentRuntimeOutput } from "./runtime";

export type ScoredFinding = AgentRuntimeOutput["findings"][number] & {
  sourceAgents: AgentName[];
  severityScore: number;
};

export type CanonicalFinding = {
  canonicalKey: string;
  reviewRunId: string;
  contractVersionId: string;
  type: "risky-language" | "missing-clause" | "ambiguity" | "compliance" | "cross-clause-conflict";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  severityScore: number;
  status: "open";
  suggestedRedline: string | null;
  sourceAgents: AgentName[];
  evidence: Array<{
    clauseId: string | null;
    startOffset: number;
    endOffset: number;
    excerpt: string;
  }>;
};

function normalizeEvidence(finding: ScoredFinding) {
  return [...finding.evidence]
    .sort((left, right) => left.startOffset - right.startOffset)
    .map((evidence) => ({
      clauseId: evidence.clauseId,
      startOffset: evidence.startOffset,
      endOffset: evidence.endOffset,
      excerpt: evidence.excerpt.trim()
    }));
}

function buildCanonicalKey(
  reviewRunId: string,
  contractVersionId: string,
  finding: ScoredFinding
) {
  const payload = JSON.stringify({
    reviewRunId,
    contractVersionId,
    type: finding.type,
    title: finding.title,
    evidence: finding.evidence.map((item) => [
      item.clauseId,
      item.startOffset,
      item.endOffset
    ])
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function normalizeFindings(
  reviewRunId: string,
  contractVersionId: string,
  findings: ScoredFinding[]
): CanonicalFinding[] {
  return findings.map((finding) => ({
    canonicalKey: buildCanonicalKey(reviewRunId, contractVersionId, finding),
    reviewRunId,
    contractVersionId,
    type: finding.type,
    title: finding.title.trim(),
    description: finding.description.trim(),
    severity: finding.severity,
    confidence: Math.max(0, Math.min(1, finding.confidence)),
    severityScore: finding.severityScore,
    status: "open",
    suggestedRedline: finding.suggestedRedline?.trim() ?? null,
    sourceAgents: [...finding.sourceAgents],
    evidence: normalizeEvidence(finding)
  }));
}
