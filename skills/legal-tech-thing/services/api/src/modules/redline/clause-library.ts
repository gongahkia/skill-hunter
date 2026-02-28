import type { AgentRuntimeOutput } from "../agents/runtime";

export type RedlineSeverityBucket = "high" | "medium" | "low";
type FindingType = AgentRuntimeOutput["findings"][number]["type"];

type ClauseLibraryEntry = {
  id: string;
  language: string;
  findingType: FindingType | "fallback-safe";
  severityBucket: RedlineSeverityBucket | "any";
  text: string;
};

const clauseLibraryEntries: ClauseLibraryEntry[] = [
  {
    id: "safe-clause-en",
    language: "en",
    findingType: "fallback-safe",
    severityBucket: "any",
    text: "Neither party will be liable for indirect, incidental, or consequential damages, and total aggregate liability is capped at fees paid in the prior twelve months, except for fraud, willful misconduct, and obligations that cannot be limited by law."
  },
  {
    id: "safe-clause-es",
    language: "es",
    findingType: "fallback-safe",
    severityBucket: "any",
    text: "Ninguna de las partes sera responsable por danos indirectos, incidentales o consecuenciales, y la responsabilidad total agregada se limita a las tarifas pagadas en los doce meses anteriores, salvo fraude, dolo y obligaciones no limitables por ley."
  },
  {
    id: "risky-language-high-en",
    language: "en",
    findingType: "risky-language",
    severityBucket: "high",
    text: "Replace broad risk language with explicit caps, carve-outs, and objective obligations tied to contract value."
  },
  {
    id: "risky-language-medium-en",
    language: "en",
    findingType: "risky-language",
    severityBucket: "medium",
    text: "Clarify obligations by narrowing scope, adding defined terms, and limiting exposure to direct losses."
  },
  {
    id: "risky-language-low-en",
    language: "en",
    findingType: "risky-language",
    severityBucket: "low",
    text: "Clarify wording to reduce interpretation risk and align terms with the agreed risk allocation."
  },
  {
    id: "missing-clause-high-en",
    language: "en",
    findingType: "missing-clause",
    severityBucket: "high",
    text: "Add a dedicated clause that states scope, obligations, remedies, and governing standard in explicit terms."
  },
  {
    id: "missing-clause-medium-en",
    language: "en",
    findingType: "missing-clause",
    severityBucket: "medium",
    text: "Add missing section language aligned with policy baseline and negotiation fallback positions."
  },
  {
    id: "missing-clause-low-en",
    language: "en",
    findingType: "missing-clause",
    severityBucket: "low",
    text: "Insert lightweight protective language to cover the missing operational requirement."
  },
  {
    id: "ambiguity-high-en",
    language: "en",
    findingType: "ambiguity",
    severityBucket: "high",
    text: "Replace subjective phrases with measurable standards, firm timelines, and defined acceptance criteria."
  },
  {
    id: "ambiguity-medium-en",
    language: "en",
    findingType: "ambiguity",
    severityBucket: "medium",
    text: "Define vague terms and convert discretionary statements into objective obligations."
  },
  {
    id: "ambiguity-low-en",
    language: "en",
    findingType: "ambiguity",
    severityBucket: "low",
    text: "Clarify phrasing and align term definitions with the definitions section."
  },
  {
    id: "compliance-high-en",
    language: "en",
    findingType: "compliance",
    severityBucket: "high",
    text: "Insert policy-required wording verbatim and remove prohibited language that conflicts with compliance controls."
  },
  {
    id: "compliance-medium-en",
    language: "en",
    findingType: "compliance",
    severityBucket: "medium",
    text: "Align clause text with policy pattern requirements and jurisdiction controls."
  },
  {
    id: "compliance-low-en",
    language: "en",
    findingType: "compliance",
    severityBucket: "low",
    text: "Adjust language to satisfy baseline compliance checks with minimal scope change."
  },
  {
    id: "cross-conflict-high-en",
    language: "en",
    findingType: "cross-clause-conflict",
    severityBucket: "high",
    text: "Resolve conflicting clauses by selecting one controlling rule and deleting contradictory language."
  },
  {
    id: "cross-conflict-medium-en",
    language: "en",
    findingType: "cross-clause-conflict",
    severityBucket: "medium",
    text: "Harmonize conflicting obligations and reference a single authoritative section."
  },
  {
    id: "cross-conflict-low-en",
    language: "en",
    findingType: "cross-clause-conflict",
    severityBucket: "low",
    text: "Adjust cross-references to ensure consistent interpretation across related sections."
  }
];

function normalizeLanguage(language: string | null | undefined) {
  if (!language) {
    return "en";
  }

  return language.trim().toLowerCase().replace(/_/g, "-");
}

function getLanguageCandidates(language: string | null | undefined) {
  const normalized = normalizeLanguage(language);
  const candidates = new Set<string>();

  candidates.add(normalized);

  const [baseLanguage] = normalized.split("-");
  if (baseLanguage) {
    candidates.add(baseLanguage);
  }

  candidates.add("en");
  return Array.from(candidates);
}

export function getClauseLibrarySnippet(input: {
  findingType: FindingType | "fallback-safe";
  severityBucket: RedlineSeverityBucket | "any";
  language?: string | null;
}) {
  const languageCandidates = getLanguageCandidates(input.language);

  for (const language of languageCandidates) {
    const match = clauseLibraryEntries.find(
      (entry) =>
        entry.language === language &&
        entry.findingType === input.findingType &&
        entry.severityBucket === input.severityBucket
    );

    if (match) {
      return match.text;
    }
  }

  return null;
}
