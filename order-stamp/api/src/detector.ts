import type { DetectionFinding, DetectionReport, RuleDefinition } from "./types.js";

const rules: RuleDefinition[] = [
  {
    id: "forced-arbitration",
    title: "Forced arbitration / class-action waiver",
    severity: "critical",
    weight: 28,
    pattern: /binding arbitration|class action waiver|waive(?:s|d)?\s+the\s+right\s+to\s+sue/gi,
    explanation:
      "The clause appears to restrict court access or collective legal action rights.",
    recommendation:
      "Negotiate opt-out language, preserve injunctive relief, and remove blanket class-action waivers."
  },
  {
    id: "unilateral-change",
    title: "Unilateral terms change rights",
    severity: "high",
    weight: 22,
    pattern: /may modify these terms at any time|without notice|sole discretion to amend/gi,
    explanation:
      "The provider can materially change obligations without symmetric consent.",
    recommendation:
      "Require advance notice, explicit assent for material changes, and termination rights without penalty."
  },
  {
    id: "auto-renewal",
    title: "Auto-renewal without explicit re-consent",
    severity: "high",
    weight: 20,
    pattern: /automatically renew|auto\s*-?renew|renews unless canceled/gi,
    explanation:
      "The agreement may renew silently, creating lock-in risk.",
    recommendation:
      "Add pre-renewal reminders and explicit opt-in requirements before renewal is effective."
  },
  {
    id: "consent-bundling",
    title: "Bundled consent language",
    severity: "medium",
    weight: 16,
    pattern: /by continuing you agree|using this service means you consent|combined consent/gi,
    explanation:
      "Consent appears bundled with service use, which may be non-specific and hard to revoke.",
    recommendation:
      "Separate optional consent purposes and provide granular choices with revocation controls."
  },
  {
    id: "broad-data-sharing",
    title: "Broad third-party data sharing",
    severity: "medium",
    weight: 14,
    pattern: /share your data with partners|sell your data|third parties for any business purpose/gi,
    explanation:
      "The text suggests broad onward transfer of personal data.",
    recommendation:
      "Constrain sharing purposes, list recipients/categories, and add retention/deletion limits."
  },
  {
    id: "liability-disclaimer",
    title: "Extreme liability disclaimer",
    severity: "high",
    weight: 18,
    pattern: /provided as is|disclaim(?:s|er) all liability|no liability whatsoever/gi,
    explanation:
      "The clause may eliminate remedies beyond commercially reasonable levels.",
    recommendation:
      "Add carve-outs for confidentiality, willful misconduct, and statutory rights."
  }
];

const severityRank: Record<DetectionFinding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractContext(text: string, start: number, end: number) {
  const contextStart = Math.max(0, start - 90);
  const contextEnd = Math.min(text.length, end + 90);
  return text.slice(contextStart, contextEnd).trim();
}

function verdictFromScore(riskScore: number): DetectionReport["verdict"] {
  if (riskScore >= 70) {
    return "high-risk";
  }

  if (riskScore >= 35) {
    return "review";
  }

  return "safe";
}

export function getDetectorRules() {
  return rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    weight: rule.weight,
    explanation: rule.explanation,
    recommendation: rule.recommendation
  }));
}

export function detectAdversarialClauses(textInput: string, maxFindings = 25): DetectionReport {
  const text = normalizeText(textInput);
  const findings: DetectionFinding[] = [];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match = rule.pattern.exec(text);
    let matchesForRule = 0;

    while (match && matchesForRule < 10) {
      const startOffset = match.index;
      const matchedText = match[0] ?? "";
      const endOffset = startOffset + matchedText.length;

      findings.push({
        id: crypto.randomUUID(),
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        score: rule.weight,
        matchedText,
        startOffset,
        endOffset,
        context: extractContext(text, startOffset, endOffset),
        explanation: rule.explanation,
        recommendation: rule.recommendation
      });

      matchesForRule += 1;
      match = rule.pattern.exec(text);
    }
  }

  const ordered = findings.sort((left, right) => {
    const severityDelta = severityRank[right.severity] - severityRank[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return right.score - left.score;
  });

  const bounded = ordered.slice(0, Math.max(1, maxFindings));
  const rawScore = bounded.reduce((total, finding) => total + finding.score, 0);
  const riskScore = Math.min(100, rawScore);

  return {
    riskScore,
    verdict: verdictFromScore(riskScore),
    findings: bounded
  };
}
