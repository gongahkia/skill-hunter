import type { AgentExecutor, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";
import { resolveSpecialistPromptUsage } from "./prompt-usage";

type RequiredClause = {
  name: string;
  clauseType: string;
  headingPatterns: RegExp[];
  severity: "critical" | "high" | "medium" | "low" | "info";
};

const baseRequiredClauses: RequiredClause[] = [
  {
    name: "Term and Termination",
    clauseType: "term",
    headingPatterns: [/\bterm\b/i, /\btermination\b/i],
    severity: "high"
  },
  {
    name: "Liability Cap",
    clauseType: "liability",
    headingPatterns: [/\bliability\b/i, /\blimitation of liability\b/i],
    severity: "critical"
  },
  {
    name: "Confidentiality",
    clauseType: "confidentiality",
    headingPatterns: [/\bconfidential(?:ity)?\b/i, /\bnon-disclosure\b/i],
    severity: "high"
  },
  {
    name: "Intellectual Property",
    clauseType: "ip",
    headingPatterns: [/\bintellectual property\b/i, /\bownership\b/i],
    severity: "high"
  },
  {
    name: "Governing Law",
    clauseType: "governing-law",
    headingPatterns: [/\bgoverning law\b/i, /\bjurisdiction\b/i],
    severity: "medium"
  }
];

const dpARequiredClauses: RequiredClause[] = [
  {
    name: "Data Processing",
    clauseType: "privacy",
    headingPatterns: [/\bdata processing\b/i, /\bdata protection\b/i],
    severity: "critical"
  }
];

function getRequiredClauses(input: AgentRuntimeInput) {
  const contractType = input.contractType?.toLowerCase();

  if (contractType?.includes("dpa") || contractType?.includes("privacy")) {
    return [...baseRequiredClauses, ...dpARequiredClauses];
  }

  return baseRequiredClauses;
}

function clauseMatchesRequirement(clause: AgentRuntimeInput["clauses"][number], requirement: RequiredClause) {
  if (clause.type.toLowerCase() === requirement.clauseType.toLowerCase()) {
    return true;
  }

  const searchText = `${clause.heading ?? ""}\n${clause.text}`;
  return requirement.headingPatterns.some((pattern) => pattern.test(searchText));
}

export const missingClauseAgent: AgentExecutor = async (
  input: AgentRuntimeInput
): Promise<AgentRuntimeOutput> => {
  const promptContext = await resolveSpecialistPromptUsage("missing-clause", input);
  const requiredClauses = getRequiredClauses(input);

  const findings = requiredClauses
    .filter(
      (requiredClause) =>
        !input.clauses.some((clause) =>
          clauseMatchesRequirement(clause, requiredClause)
        )
    )
    .map((missingClause) => ({
      type: "missing-clause" as const,
      title: `${missingClause.name} clause missing`,
      description: `The contract appears to be missing a required ${missingClause.name} section.`,
      severity: missingClause.severity,
      confidence: 0.86,
      suggestedRedline: `Add a ${missingClause.name} section aligned with organizational policy requirements.`,
      evidence: [
        {
          clauseId: null,
          startOffset: 0,
          endOffset: 0,
          excerpt: `No matching clause detected for required section: ${missingClause.name}.`
        }
      ]
    }));

  return {
    findings,
    usage: promptContext.usage
  };
};
