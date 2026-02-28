import type { AgentExecutor, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";

type RiskPattern = {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  regex: RegExp;
  suggestedRedline: string | null;
};

const riskPatterns: RiskPattern[] = [
  {
    title: "Unlimited Liability",
    description:
      "The clause suggests uncapped liability exposure without explicit monetary limits.",
    severity: "critical",
    regex: /\bunlimited\s+liabilit(y|ies)\b|\bliability\s+shall\s+not\s+be\s+limited\b/i,
    suggestedRedline:
      "Cap total liability to fees paid in the preceding 12 months, excluding intentional misconduct."
  },
  {
    title: "Broad Indemnity Scope",
    description:
      "The indemnity obligation appears broad and may include third-party and first-party losses without carve-outs.",
    severity: "high",
    regex: /\bindemnif(y|ies|ication)\b.{0,80}\ball\s+loss(es)?\b/i,
    suggestedRedline:
      "Limit indemnity to third-party claims caused by proven breach and add exclusions for customer modifications."
  },
  {
    title: "Unilateral Termination",
    description:
      "Termination rights appear one-sided and can create execution risk.",
    severity: "medium",
    regex: /\bmay\s+terminate\s+at\s+any\s+time\b|\bsole\s+discretion\b/i,
    suggestedRedline:
      "Require mutual termination rights with cure periods for material breach."
  },
  {
    title: "Perpetual Confidentiality",
    description:
      "Confidentiality obligations without time limits may be commercially unreasonable.",
    severity: "low",
    regex: /\bconfidentiality\b.{0,80}\bperpetual\b/i,
    suggestedRedline:
      "Set confidentiality survival to 3-5 years, except for trade secrets where legally permitted."
  }
];

function buildEvidenceExcerpt(text: string, startOffset: number) {
  const excerptStart = Math.max(0, startOffset - 60);
  const excerptEnd = Math.min(text.length, startOffset + 160);

  return text.slice(excerptStart, excerptEnd).trim();
}

export const riskScannerAgent: AgentExecutor = async (
  input: AgentRuntimeInput
): Promise<AgentRuntimeOutput> => {
  const findings: AgentRuntimeOutput["findings"] = [];

  for (const clause of input.clauses) {
    for (const pattern of riskPatterns) {
      const match = pattern.regex.exec(clause.text);

      if (!match) {
        continue;
      }

      const localStart = match.index;
      const globalStart = clause.startOffset + localStart;
      const globalEnd = globalStart + match[0].length;

      findings.push({
        type: "risky-language",
        title: pattern.title,
        description: pattern.description,
        severity: pattern.severity,
        confidence: 0.78,
        suggestedRedline: pattern.suggestedRedline,
        evidence: [
          {
            clauseId: clause.id,
            startOffset: globalStart,
            endOffset: globalEnd,
            excerpt: buildEvidenceExcerpt(clause.text, localStart)
          }
        ]
      });
    }
  }

  return {
    findings,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }
  };
};
