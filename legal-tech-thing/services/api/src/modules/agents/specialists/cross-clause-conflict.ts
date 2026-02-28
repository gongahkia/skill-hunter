import type { AgentExecutor, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";
import { resolveSpecialistPromptUsage } from "./prompt-usage";

type ConflictRule = {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  leftPattern: RegExp;
  rightPattern: RegExp;
};

const conflictRules: ConflictRule[] = [
  {
    title: "Termination rights conflict",
    description:
      "One clause allows broad unilateral termination while another restricts termination rights.",
    severity: "high",
    leftPattern: /\bterminate\s+at\s+any\s+time\b|\bwithout\s+cause\b/i,
    rightPattern: /\bmay\s+not\s+terminate\b|\bnon-?cancell?able\b|\bfixed\s+term\b/i
  },
  {
    title: "Liability cap conflict",
    description:
      "One clause indicates uncapped liability while another imposes a liability cap.",
    severity: "critical",
    leftPattern: /\bunlimited\s+liabilit(y|ies)\b|\bliability\s+shall\s+not\s+be\s+limited\b/i,
    rightPattern: /\bliability\b.{0,80}\blimited\s+to\b|\bcap\s+on\s+liability\b/i
  },
  {
    title: "Assignment rights conflict",
    description:
      "Assignment prohibition conflicts with assignment permission language.",
    severity: "medium",
    leftPattern: /\bshall\s+not\s+assign\b|\bassignment\s+prohibited\b/i,
    rightPattern: /\bmay\s+assign\b.{0,40}\bwithout\s+consent\b/i
  }
];

function excerptAround(text: string, localIndex: number) {
  const start = Math.max(0, localIndex - 50);
  const end = Math.min(text.length, localIndex + 150);
  return text.slice(start, end).trim();
}

function detectGoverningLaw(clauseText: string) {
  const match = clauseText.match(
    /governed\s+by\s+the\s+laws\s+of\s+([A-Za-z\s]+?)(?:\.|,|\n|$)/i
  );

  if (!match?.[1]) {
    return null;
  }

  return match[1].trim().toLowerCase();
}

export const crossClauseConflictAgent: AgentExecutor = async (
  input: AgentRuntimeInput
): Promise<AgentRuntimeOutput> => {
  const promptContext = await resolveSpecialistPromptUsage(
    "cross-clause-conflict",
    input
  );
  const findings: AgentRuntimeOutput["findings"] = [];

  for (let i = 0; i < input.clauses.length; i += 1) {
    const leftClause = input.clauses[i];

    if (!leftClause) {
      continue;
    }

    for (let j = i + 1; j < input.clauses.length; j += 1) {
      const rightClause = input.clauses[j];

      if (!rightClause) {
        continue;
      }

      for (const rule of conflictRules) {
        const leftMatch = rule.leftPattern.exec(leftClause.text);
        const rightMatch = rule.rightPattern.exec(rightClause.text);

        if (!leftMatch || !rightMatch) {
          continue;
        }

        findings.push({
          type: "cross-clause-conflict",
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          confidence: 0.76,
          suggestedRedline:
            "Harmonize conflicting obligations and define one authoritative rule for this topic.",
          evidence: [
            {
              clauseId: leftClause.id,
              startOffset: leftClause.startOffset + leftMatch.index,
              endOffset: leftClause.startOffset + leftMatch.index + leftMatch[0].length,
              excerpt: excerptAround(leftClause.text, leftMatch.index)
            },
            {
              clauseId: rightClause.id,
              startOffset: rightClause.startOffset + rightMatch.index,
              endOffset: rightClause.startOffset + rightMatch.index + rightMatch[0].length,
              excerpt: excerptAround(rightClause.text, rightMatch.index)
            }
          ]
        });
      }

      const leftLaw = detectGoverningLaw(leftClause.text);
      const rightLaw = detectGoverningLaw(rightClause.text);

      if (leftLaw && rightLaw && leftLaw !== rightLaw) {
        findings.push({
          type: "cross-clause-conflict",
          title: "Governing law mismatch",
          description:
            "Different clauses specify different governing jurisdictions, creating enforceability risk.",
          severity: "high",
          confidence: 0.83,
          suggestedRedline:
            "Select one governing law and align all governing-law and dispute-resolution sections.",
          evidence: [
            {
              clauseId: leftClause.id,
              startOffset: leftClause.startOffset,
              endOffset: leftClause.endOffset,
              excerpt: leftClause.text.slice(0, 180)
            },
            {
              clauseId: rightClause.id,
              startOffset: rightClause.startOffset,
              endOffset: rightClause.endOffset,
              excerpt: rightClause.text.slice(0, 180)
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
