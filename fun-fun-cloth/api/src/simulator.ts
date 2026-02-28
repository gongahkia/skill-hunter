import type { ClauseCandidate, CompiledPolicy, PolicySeverity, SimulationViolation } from "./types.js";

const severityScore: Record<PolicySeverity, number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 6,
  info: 2
};

function inferClauseType(text: string) {
  const normalized = text.toLowerCase();

  if (/liability|limitation of liability/.test(normalized)) return "LIABILITY";
  if (/payment|fees|invoice/.test(normalized)) return "PAYMENT";
  if (/termination|terminate/.test(normalized)) return "TERMINATION";
  if (/confidential|non-disclosure/.test(normalized)) return "CONFIDENTIALITY";
  if (/privacy|data protection|data processing/.test(normalized)) return "PRIVACY";
  if (/governing law|jurisdiction|venue/.test(normalized)) return "GOVERNING_LAW";
  return "UNKNOWN";
}

function segmentContractClauses(contractText: string): ClauseCandidate[] {
  const blocks = contractText
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((text, index) => ({
    id: `clause-${index + 1}`,
    clauseType: inferClauseType(text),
    text
  }));
}

function snippet(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export function simulatePolicy(compiledPolicy: CompiledPolicy, contractText: string) {
  const clauses = segmentContractClauses(contractText);
  const violations: SimulationViolation[] = [];

  for (const rule of compiledPolicy.rules) {
    const matchingClauses = clauses.filter((clause) => clause.clauseType === rule.clauseType);

    if (matchingClauses.length === 0 && rule.requirePattern) {
      violations.push({
        ruleId: rule.id,
        clauseType: rule.clauseType,
        severity: rule.severity,
        reason: `No clause found for required type ${rule.clauseType}`,
        remediation: rule.remediation,
        clauseSnippet: ""
      });
      continue;
    }

    const requireRegex =
      rule.requirePattern !== null
        ? new RegExp(rule.requirePattern, rule.requireFlags ?? "")
        : null;
    const forbidRegex =
      rule.forbidPattern !== null
        ? new RegExp(rule.forbidPattern, rule.forbidFlags ?? "")
        : null;

    for (const clause of matchingClauses) {
      if (requireRegex && !requireRegex.test(clause.text)) {
        violations.push({
          ruleId: rule.id,
          clauseType: rule.clauseType,
          severity: rule.severity,
          reason: `Required pattern missing: /${rule.requirePattern}/${rule.requireFlags ?? ""}`,
          remediation: rule.remediation,
          clauseSnippet: snippet(clause.text)
        });
      }

      if (forbidRegex && forbidRegex.test(clause.text)) {
        violations.push({
          ruleId: rule.id,
          clauseType: rule.clauseType,
          severity: rule.severity,
          reason: `Forbidden pattern present: /${rule.forbidPattern}/${rule.forbidFlags ?? ""}`,
          remediation: rule.remediation,
          clauseSnippet: snippet(clause.text)
        });
      }
    }
  }

  const riskScore = Math.min(
    100,
    violations.reduce((total, item) => total + severityScore[item.severity], 0)
  );

  return {
    clausesAnalyzed: clauses.length,
    violations,
    riskScore,
    verdict: riskScore >= 70 ? "high-risk" : riskScore >= 35 ? "review" : "safe"
  };
}
