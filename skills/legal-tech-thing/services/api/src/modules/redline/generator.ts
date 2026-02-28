import type { AgentName, AgentRuntimeOutput } from "../agents/runtime";
import {
  getClauseLibrarySnippet,
  type RedlineSeverityBucket
} from "./clause-library";

type ScoredFinding = AgentRuntimeOutput["findings"][number] & {
  sourceAgents: AgentName[];
  severityScore: number;
};

const defaultSafeClause =
  "Neither party will be liable for indirect, incidental, or consequential damages, and total aggregate liability is capped at fees paid in the prior twelve months, except for fraud, willful misconduct, and obligations that cannot be limited by law.";
const defaultTemplate =
  "Clarify wording to reduce interpretation risk and align terms with negotiated obligations.";

function getSeverityBucket(severity: ScoredFinding["severity"]) {
  if (severity === "critical" || severity === "high") {
    return "high" as const satisfies RedlineSeverityBucket;
  }

  if (severity === "medium") {
    return "medium" as const satisfies RedlineSeverityBucket;
  }

  return "low" as const satisfies RedlineSeverityBucket;
}

export function generateSuggestedRedline(
  finding: ScoredFinding,
  language: string | null = "en"
) {
  if (finding.suggestedRedline && finding.suggestedRedline.trim().length > 0) {
    return finding.suggestedRedline.trim();
  }

  const bucket = getSeverityBucket(finding.severity);
  const template =
    getClauseLibrarySnippet({
      findingType: finding.type,
      severityBucket: bucket,
      language
    }) ?? defaultTemplate;

  if (bucket === "high") {
    const safeClause =
      getClauseLibrarySnippet({
        findingType: "fallback-safe",
        severityBucket: "any",
        language
      }) ?? defaultSafeClause;
    return `${template} Fallback safe clause: ${safeClause}`;
  }

  return template;
}

export function applySuggestedRedlines(
  findings: ScoredFinding[],
  options: {
    language?: string | null;
  } = {}
) {
  return findings.map((finding) => ({
    ...finding,
    suggestedRedline: generateSuggestedRedline(finding, options.language ?? "en")
  }));
}
