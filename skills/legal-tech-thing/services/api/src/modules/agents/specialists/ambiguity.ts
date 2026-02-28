import type { AgentExecutor, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";

const vaguePatterns = [
  {
    regex: /\breasonable\s+efforts\b/i,
    title: "Ambiguous effort standard",
    description:
      "The clause uses 'reasonable efforts' without objective criteria or measurable obligations."
  },
  {
    regex: /\bas\s+needed\b|\bas\s+appropriate\b|\bfrom\s+time\s+to\s+time\b/i,
    title: "Open-ended obligation",
    description:
      "The clause contains open-ended timing language that may be interpreted inconsistently."
  },
  {
    regex: /\bmaterial\b(?!\s+breach)/i,
    title: "Undefined materiality",
    description:
      "The clause references 'material' concepts without defining objective thresholds."
  }
];

function collectDefinedTerms(clauses: AgentRuntimeInput["clauses"]) {
  const definedTerms = new Set<string>();

  for (const clause of clauses) {
    const definitionMatches = clause.text.matchAll(
      /"([A-Z][A-Za-z0-9\s-]{1,80})"\s+means|\b([A-Z][A-Za-z0-9\s-]{1,80})\s+means\b/g
    );

    for (const match of definitionMatches) {
      const term = (match[1] ?? match[2] ?? "").trim();

      if (term) {
        definedTerms.add(term.toLowerCase());
      }
    }
  }

  return definedTerms;
}

function extractQuotedTerms(text: string) {
  return [...text.matchAll(/"([A-Z][A-Za-z0-9\s-]{1,80})"/g)].map((match) => ({
    term: (match[1] ?? "").trim(),
    localIndex: match.index ?? 0,
    rawMatch: match[0] ?? ""
  }));
}

function excerptAround(text: string, localIndex: number) {
  const start = Math.max(0, localIndex - 50);
  const end = Math.min(text.length, localIndex + 140);
  return text.slice(start, end).trim();
}

export const ambiguityAgent: AgentExecutor = async (
  input: AgentRuntimeInput
): Promise<AgentRuntimeOutput> => {
  const findings: AgentRuntimeOutput["findings"] = [];
  const definedTerms = collectDefinedTerms(input.clauses);

  for (const clause of input.clauses) {
    for (const pattern of vaguePatterns) {
      const match = pattern.regex.exec(clause.text);

      if (!match) {
        continue;
      }

      const localStart = match.index;
      const globalStart = clause.startOffset + localStart;
      const globalEnd = globalStart + match[0].length;

      findings.push({
        type: "ambiguity",
        title: pattern.title,
        description: pattern.description,
        severity: "medium",
        confidence: 0.74,
        suggestedRedline:
          "Replace subjective language with objective criteria, timelines, or measurable standards.",
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

    const quotedTerms = extractQuotedTerms(clause.text);

    for (const quotedTerm of quotedTerms) {
      if (!quotedTerm.term) {
        continue;
      }

      if (definedTerms.has(quotedTerm.term.toLowerCase())) {
        continue;
      }

      const globalStart = clause.startOffset + quotedTerm.localIndex;
      const globalEnd = globalStart + quotedTerm.rawMatch.length;

      findings.push({
        type: "ambiguity",
        title: "Undefined reference term",
        description: `The quoted term "${quotedTerm.term}" appears undefined and may cause interpretation risk.`,
        severity: "medium",
        confidence: 0.7,
        suggestedRedline:
          "Define the referenced term in a definitions section or replace it with existing defined language.",
        evidence: [
          {
            clauseId: clause.id,
            startOffset: globalStart,
            endOffset: globalEnd,
            excerpt: excerptAround(clause.text, quotedTerm.localIndex)
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
