export type PolicySeverity = "critical" | "high" | "medium" | "low" | "info";

export type CompiledRule = {
  id: string;
  clauseType: string;
  requirePattern: string | null;
  requireFlags: string | null;
  forbidPattern: string | null;
  forbidFlags: string | null;
  severity: PolicySeverity;
  remediation: string;
};

export type CompiledPolicy = {
  policyName: string;
  compiledAt: string;
  rules: CompiledRule[];
};

export type SimulationViolation = {
  ruleId: string;
  clauseType: string;
  severity: PolicySeverity;
  reason: string;
  remediation: string;
  clauseSnippet: string;
};

export type ClauseCandidate = {
  id: string;
  clauseType: string;
  text: string;
};
