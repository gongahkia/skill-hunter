export type RuleSeverity = "critical" | "high" | "medium" | "low";

export type RuleDefinition = {
  id: string;
  title: string;
  severity: RuleSeverity;
  weight: number;
  pattern: RegExp;
  explanation: string;
  recommendation: string;
};

export type DetectionFinding = {
  id: string;
  ruleId: string;
  title: string;
  severity: RuleSeverity;
  score: number;
  matchedText: string;
  startOffset: number;
  endOffset: number;
  context: string;
  explanation: string;
  recommendation: string;
};

export type DetectionReport = {
  riskScore: number;
  verdict: "safe" | "review" | "high-risk";
  findings: DetectionFinding[];
};
