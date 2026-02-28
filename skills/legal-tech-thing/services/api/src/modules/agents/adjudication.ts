import type { AgentName, AgentRuntimeOutput } from "./runtime";

export type SourcedFinding = AgentRuntimeOutput["findings"][number] & {
  sourceAgent: AgentName;
};

export type AdjudicatedFinding = AgentRuntimeOutput["findings"][number] & {
  sourceAgents: AgentName[];
};

const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
} as const;

function overlapRatio(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  const overlap = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

  if (overlap === 0) {
    return 0;
  }

  const minLength = Math.max(1, Math.min(endA - startA, endB - startB));
  return overlap / minLength;
}

function findingsOverlap(a: SourcedFinding, b: SourcedFinding) {
  if (a.type !== b.type) {
    return false;
  }

  for (const evidenceA of a.evidence) {
    for (const evidenceB of b.evidence) {
      if (evidenceA.clauseId && evidenceB.clauseId && evidenceA.clauseId !== evidenceB.clauseId) {
        continue;
      }

      if (
        overlapRatio(
          evidenceA.startOffset,
          evidenceA.endOffset,
          evidenceB.startOffset,
          evidenceB.endOffset
        ) >= 0.3
      ) {
        return true;
      }
    }
  }

  return false;
}

function dedupeEvidence(evidence: SourcedFinding["evidence"]) {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = `${item.clauseId ?? "none"}:${item.startOffset}:${item.endOffset}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeFindings(a: AdjudicatedFinding, b: SourcedFinding): AdjudicatedFinding {
  const higherSeverity =
    severityRank[a.severity] >= severityRank[b.severity] ? a.severity : b.severity;

  return {
    type: a.type,
    title: a.title.length >= b.title.length ? a.title : b.title,
    description:
      a.description.length >= b.description.length ? a.description : b.description,
    severity: higherSeverity,
    confidence: Math.max(a.confidence, b.confidence),
    suggestedRedline: a.suggestedRedline ?? b.suggestedRedline,
    evidence: dedupeEvidence([...a.evidence, ...b.evidence]),
    sourceAgents: [...new Set([...a.sourceAgents, b.sourceAgent])]
  };
}

export function adjudicateFindings(findings: SourcedFinding[]): AdjudicatedFinding[] {
  const sorted = [...findings].sort((left, right) => {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[right.severity] - severityRank[left.severity];
    }

    return right.confidence - left.confidence;
  });

  const adjudicated: AdjudicatedFinding[] = [];

  for (const finding of sorted) {
    const existingIndex = adjudicated.findIndex((item) =>
      findingsOverlap(
        {
          ...item,
          sourceAgent: item.sourceAgents[0] ?? "adjudicator"
        },
        finding
      )
    );

    if (existingIndex === -1) {
      adjudicated.push({
        ...finding,
        sourceAgents: [finding.sourceAgent]
      });
      continue;
    }

    const existing = adjudicated[existingIndex];

    if (!existing) {
      continue;
    }

    adjudicated[existingIndex] = mergeFindings(existing, finding);
  }

  return adjudicated;
}
