import { apiClient } from "../lib/api-client";

type JsonObject = Record<string, unknown>;

export type PolicyProvider = "OPENAI" | "ANTHROPIC" | "GEMINI" | "OLLAMA";

export type PolicySeverity = "critical" | "high" | "medium" | "low" | "info";

export type PolicyThresholds = {
  criticalMinConfidence: number;
  highMinConfidence: number;
  mediumMinConfidence: number;
  autoEscalateSeverity: PolicySeverity;
};

export type EnabledAgents = {
  riskScanner: boolean;
  missingClause: boolean;
  ambiguity: boolean;
  compliance: boolean;
  crossClauseConflict: boolean;
};

export type PolicyProfile = {
  id: string;
  userId: string;
  defaultProvider: PolicyProvider;
  thresholds: PolicyThresholds;
  enabledAgents: EnabledAgents;
  createdAt: string;
  updatedAt: string;
};

type PolicyProfileResponse = {
  profile: {
    id: string;
    userId: string;
    defaultProvider: PolicyProvider;
    riskThresholds: unknown;
    createdAt: string;
    updatedAt: string;
  };
};

const defaultThresholds: PolicyThresholds = {
  criticalMinConfidence: 0.8,
  highMinConfidence: 0.7,
  mediumMinConfidence: 0.6,
  autoEscalateSeverity: "high"
};

const defaultEnabledAgents: EnabledAgents = {
  riskScanner: true,
  missingClause: true,
  ambiguity: true,
  compliance: true,
  crossClauseConflict: true
};

const validSeverities = new Set<PolicySeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "info"
]);

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function toBoundedNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
}

function normalizeThresholds(value: unknown) {
  const root = isJsonObject(value) ? value : {};
  const candidate = isJsonObject(root.thresholds) ? root.thresholds : root;
  const severity = candidate.autoEscalateSeverity;

  return {
    criticalMinConfidence: toBoundedNumber(
      candidate.criticalMinConfidence,
      defaultThresholds.criticalMinConfidence
    ),
    highMinConfidence: toBoundedNumber(
      candidate.highMinConfidence,
      defaultThresholds.highMinConfidence
    ),
    mediumMinConfidence: toBoundedNumber(
      candidate.mediumMinConfidence,
      defaultThresholds.mediumMinConfidence
    ),
    autoEscalateSeverity:
      typeof severity === "string" && validSeverities.has(severity as PolicySeverity)
        ? (severity as PolicySeverity)
        : defaultThresholds.autoEscalateSeverity
  } satisfies PolicyThresholds;
}

function normalizeEnabledAgents(value: unknown) {
  const root = isJsonObject(value) ? value : {};
  const candidate = isJsonObject(root.enabledAgents) ? root.enabledAgents : {};

  return {
    riskScanner:
      typeof candidate.riskScanner === "boolean"
        ? candidate.riskScanner
        : defaultEnabledAgents.riskScanner,
    missingClause:
      typeof candidate.missingClause === "boolean"
        ? candidate.missingClause
        : defaultEnabledAgents.missingClause,
    ambiguity:
      typeof candidate.ambiguity === "boolean" ? candidate.ambiguity : defaultEnabledAgents.ambiguity,
    compliance:
      typeof candidate.compliance === "boolean"
        ? candidate.compliance
        : defaultEnabledAgents.compliance,
    crossClauseConflict:
      typeof candidate.crossClauseConflict === "boolean"
        ? candidate.crossClauseConflict
        : defaultEnabledAgents.crossClauseConflict
  } satisfies EnabledAgents;
}

function normalizePolicyProfile(response: PolicyProfileResponse) {
  return {
    id: response.profile.id,
    userId: response.profile.userId,
    defaultProvider: response.profile.defaultProvider,
    thresholds: normalizeThresholds(response.profile.riskThresholds),
    enabledAgents: normalizeEnabledAgents(response.profile.riskThresholds),
    createdAt: response.profile.createdAt,
    updatedAt: response.profile.updatedAt
  } satisfies PolicyProfile;
}

export async function fetchMyPolicyProfile() {
  const response = await apiClient.request<PolicyProfileResponse>("/policy/profiles/me");
  return normalizePolicyProfile(response);
}

type UpdatePolicyProfileInput = {
  defaultProvider: PolicyProvider;
  thresholds: PolicyThresholds;
  enabledAgents: EnabledAgents;
};

export async function updateMyPolicyProfile(input: UpdatePolicyProfileInput) {
  const response = await apiClient.request<PolicyProfileResponse>("/policy/profiles/me", {
    method: "PUT",
    body: {
      defaultProvider: input.defaultProvider,
      thresholds: input.thresholds,
      enabledAgents: input.enabledAgents
    }
  });

  return normalizePolicyProfile(response);
}
