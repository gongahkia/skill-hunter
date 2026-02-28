import type { AgentName, AgentRuntimeOutput } from "../agents/runtime";

type ScoredFinding = AgentRuntimeOutput["findings"][number] & {
  sourceAgents: AgentName[];
  severityScore: number;
};

const fallbackSafeClause =
  "Neither party will be liable for indirect, incidental, or consequential damages, and total aggregate liability is capped at fees paid in the prior twelve months, except for fraud, willful misconduct, and obligations that cannot be limited by law.";

const redlineTemplates: Record<
  ScoredFinding["type"],
  { high: string; medium: string; low: string }
> = {
  "risky-language": {
    high: "Replace broad risk language with explicit caps, carve-outs, and objective obligations tied to contract value.",
    medium:
      "Clarify obligations by narrowing scope, adding defined terms, and limiting exposure to direct losses.",
    low: "Clarify wording to reduce interpretation risk and align terms with the agreed risk allocation."
  },
  "missing-clause": {
    high: "Add a dedicated clause that states scope, obligations, remedies, and governing standard in explicit terms.",
    medium: "Add missing section language aligned with policy baseline and negotiation fallback positions.",
    low: "Insert lightweight protective language to cover the missing operational requirement."
  },
  ambiguity: {
    high: "Replace subjective phrases with measurable standards, firm timelines, and defined acceptance criteria.",
    medium: "Define vague terms and convert discretionary statements into objective obligations.",
    low: "Clarify phrasing and align term definitions with the definitions section."
  },
  compliance: {
    high: "Insert policy-required wording verbatim and remove prohibited language that conflicts with compliance controls.",
    medium: "Align clause text with policy pattern requirements and jurisdiction controls.",
    low: "Adjust language to satisfy baseline compliance checks with minimal scope change."
  },
  "cross-clause-conflict": {
    high: "Resolve conflicting clauses by selecting one controlling rule and deleting contradictory language.",
    medium: "Harmonize conflicting obligations and reference a single authoritative section.",
    low: "Adjust cross-references to ensure consistent interpretation across related sections."
  }
};

function getSeverityBucket(severity: ScoredFinding["severity"]) {
  if (severity === "critical" || severity === "high") {
    return "high" as const;
  }

  if (severity === "medium") {
    return "medium" as const;
  }

  return "low" as const;
}

export function generateSuggestedRedline(finding: ScoredFinding) {
  if (finding.suggestedRedline && finding.suggestedRedline.trim().length > 0) {
    return finding.suggestedRedline.trim();
  }

  const template = redlineTemplates[finding.type];
  const bucket = getSeverityBucket(finding.severity);

  if (bucket === "high") {
    return `${template.high} Fallback safe clause: ${fallbackSafeClause}`;
  }

  return template[bucket];
}

export function applySuggestedRedlines(findings: ScoredFinding[]) {
  return findings.map((finding) => ({
    ...finding,
    suggestedRedline: generateSuggestedRedline(finding)
  }));
}
