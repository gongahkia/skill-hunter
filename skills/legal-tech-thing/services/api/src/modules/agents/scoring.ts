import type { AdjudicatedFinding } from "./adjudication";
import type { AgentRuntimeInput } from "./runtime";

const baseSeverityScore = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10
} as const;

function getPolicyWeight(
  finding: AdjudicatedFinding,
  policyRules: AgentRuntimeInput["policyRules"]
) {
  const evidenceText = finding.evidence
    .map((evidence) => evidence.excerpt)
    .join("\n")
    .toLowerCase();

  let highestWeight = 0;

  for (const policyRule of policyRules) {
    if (!policyRule.active) {
      continue;
    }

    const selectorMatches = evidenceText.includes(policyRule.clauseSelector.toLowerCase());

    if (!selectorMatches && policyRule.clauseRequirement) {
      const requirementMatches = finding.evidence.some(
        (evidence) => evidence.clauseId && evidence.clauseId.length > 0
      );

      if (!requirementMatches) {
        continue;
      }
    }

    const priorityScore = Math.max(0, 200 - policyRule.priority) / 200;
    const ruleWeight = 20 * priorityScore;

    if (ruleWeight > highestWeight) {
      highestWeight = ruleWeight;
    }
  }

  return highestWeight;
}

export function scoreFinding(
  finding: AdjudicatedFinding,
  policyRules: AgentRuntimeInput["policyRules"]
) {
  const severity = baseSeverityScore[finding.severity];
  const confidence = finding.confidence * 30;
  const policy = getPolicyWeight(finding, policyRules);

  return Math.round((severity + confidence + policy) * 100) / 100;
}

export function scoreFindings(
  findings: AdjudicatedFinding[],
  policyRules: AgentRuntimeInput["policyRules"]
) {
  return findings
    .map((finding) => ({
      ...finding,
      severityScore: scoreFinding(finding, policyRules)
    }))
    .sort((left, right) => right.severityScore - left.severityScore);
}
