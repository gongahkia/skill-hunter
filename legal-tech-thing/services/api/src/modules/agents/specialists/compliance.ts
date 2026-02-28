import type { AgentExecutor, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";
import { resolveSpecialistPromptUsage } from "./prompt-usage";

function buildRegex(pattern: string) {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

function clauseMatchesSelector(
  clause: AgentRuntimeInput["clauses"][number],
  clauseSelector: string,
  clauseRequirement: string | null
) {
  if (clauseRequirement && clause.type.toLowerCase() === clauseRequirement.toLowerCase()) {
    return true;
  }

  const selectorRegex = buildRegex(clauseSelector);
  return selectorRegex.test(`${clause.heading ?? ""}\n${clause.text}`);
}

function excerptAround(text: string, localIndex: number) {
  const start = Math.max(0, localIndex - 60);
  const end = Math.min(text.length, localIndex + 160);
  return text.slice(start, end).trim();
}

export const complianceAgent: AgentExecutor = async (
  input: AgentRuntimeInput
): Promise<AgentRuntimeOutput> => {
  const promptContext = await resolveSpecialistPromptUsage("compliance", input);
  const findings: AgentRuntimeOutput["findings"] = [];

  for (const rule of input.policyRules) {
    if (!rule.active) {
      continue;
    }

    const matchedClauses = input.clauses.filter((clause) =>
      clauseMatchesSelector(clause, rule.clauseSelector, rule.clauseRequirement)
    );

    if (rule.requiredPattern) {
      const requiredRegex = buildRegex(rule.requiredPattern);
      const hasRequiredPattern = matchedClauses.some((clause) =>
        requiredRegex.test(clause.text)
      );

      if (!hasRequiredPattern) {
        findings.push({
          type: "compliance",
          title: "Required compliance language missing",
          description: `Policy rule ${rule.id} requires pattern: ${rule.requiredPattern}`,
          severity: rule.allowException ? "medium" : "high",
          confidence: 0.82,
          suggestedRedline: `Add required compliance language matching: ${rule.requiredPattern}`,
          evidence: [
            {
              clauseId: matchedClauses[0]?.id ?? null,
              startOffset: matchedClauses[0]?.startOffset ?? 0,
              endOffset: matchedClauses[0]?.endOffset ?? 0,
              excerpt:
                matchedClauses[0]?.text.slice(0, 160) ??
                `No clause matched selector ${rule.clauseSelector}`
            }
          ]
        });
      }
    }

    if (rule.forbiddenPattern) {
      const forbiddenRegex = buildRegex(rule.forbiddenPattern);

      for (const clause of matchedClauses) {
        const match = forbiddenRegex.exec(clause.text);

        if (!match) {
          continue;
        }

        const localStart = match.index;
        const globalStart = clause.startOffset + localStart;
        const globalEnd = globalStart + match[0].length;

        findings.push({
          type: "compliance",
          title: "Forbidden compliance language found",
          description: `Policy rule ${rule.id} forbids pattern: ${rule.forbiddenPattern}`,
          severity: rule.allowException ? "medium" : "high",
          confidence: 0.87,
          suggestedRedline:
            "Replace forbidden language with policy-approved clause wording.",
          evidence: [
            {
              clauseId: clause.id,
              startOffset: globalStart,
              endOffset: globalEnd,
              excerpt: excerptAround(clause.text, localStart)
            }
          ]
        });
      }
    }
  }

  return {
    findings,
    usage: promptContext.usage
  };
};
