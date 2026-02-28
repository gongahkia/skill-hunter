import { API_BASE_URL } from "../config";

type JsonObject = Record<string, unknown>;

export type ExtensionPolicyMode = "personal" | "strict";

type PolicyThresholds = {
  criticalMinConfidence: number;
  highMinConfidence: number;
  mediumMinConfidence: number;
  autoEscalateSeverity: "critical" | "high" | "medium" | "low" | "info";
};

type EnabledAgents = {
  riskScanner: boolean;
  missingClause: boolean;
  ambiguity: boolean;
  compliance: boolean;
  crossClauseConflict: boolean;
};

export type ExtensionPolicyProfile = {
  id: string;
  userId: string;
  thresholds: PolicyThresholds;
  enabledAgents: EnabledAgents;
};

const strictPreset = {
  thresholds: {
    criticalMinConfidence: 0.9,
    highMinConfidence: 0.8,
    mediumMinConfidence: 0.7,
    autoEscalateSeverity: "medium"
  } satisfies PolicyThresholds,
  enabledAgents: {
    riskScanner: true,
    missingClause: true,
    ambiguity: true,
    compliance: true,
    crossClauseConflict: true
  } satisfies EnabledAgents
};

const personalPreset = {
  thresholds: {
    criticalMinConfidence: 0.75,
    highMinConfidence: 0.65,
    mediumMinConfidence: 0.55,
    autoEscalateSeverity: "high"
  } satisfies PolicyThresholds,
  enabledAgents: {
    riskScanner: true,
    missingClause: false,
    ambiguity: false,
    compliance: false,
    crossClauseConflict: false
  } satisfies EnabledAgents
};

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

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

  return {
    criticalMinConfidence: toBoundedNumber(candidate.criticalMinConfidence, 0.8),
    highMinConfidence: toBoundedNumber(candidate.highMinConfidence, 0.7),
    mediumMinConfidence: toBoundedNumber(candidate.mediumMinConfidence, 0.6),
    autoEscalateSeverity:
      candidate.autoEscalateSeverity === "critical" ||
      candidate.autoEscalateSeverity === "high" ||
      candidate.autoEscalateSeverity === "medium" ||
      candidate.autoEscalateSeverity === "low" ||
      candidate.autoEscalateSeverity === "info"
        ? candidate.autoEscalateSeverity
        : "high"
  } satisfies PolicyThresholds;
}

function normalizeEnabledAgents(value: unknown) {
  const root = isJsonObject(value) ? value : {};
  const candidate = isJsonObject(root.enabledAgents) ? root.enabledAgents : {};

  return {
    riskScanner:
      typeof candidate.riskScanner === "boolean" ? candidate.riskScanner : true,
    missingClause:
      typeof candidate.missingClause === "boolean" ? candidate.missingClause : true,
    ambiguity:
      typeof candidate.ambiguity === "boolean" ? candidate.ambiguity : true,
    compliance:
      typeof candidate.compliance === "boolean" ? candidate.compliance : true,
    crossClauseConflict:
      typeof candidate.crossClauseConflict === "boolean"
        ? candidate.crossClauseConflict
        : true
  } satisfies EnabledAgents;
}

function normalizePolicyProfile(payload: {
  profile: {
    id: string;
    userId: string;
    riskThresholds: unknown;
  };
}) {
  return {
    id: payload.profile.id,
    userId: payload.profile.userId,
    thresholds: normalizeThresholds(payload.profile.riskThresholds),
    enabledAgents: normalizeEnabledAgents(payload.profile.riskThresholds)
  } satisfies ExtensionPolicyProfile;
}

async function parseErrorCode(response: Response) {
  const fallbackCode = `HTTP_${response.status}`;
  const payload = (await response.json().catch(() => null)) as
    | { error?: string | { code?: string } }
    | null;

  if (typeof payload?.error === "string") {
    return payload.error;
  }
  if (typeof payload?.error?.code === "string") {
    return payload.error.code;
  }

  return fallbackCode;
}

async function requestWithAccessToken<T>(
  path: string,
  accessToken: string,
  options: {
    method?: "GET" | "PUT";
    body?: unknown;
  } = {}
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-request-id": generateRequestId(),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });

  if (!response.ok) {
    throw new Error(await parseErrorCode(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchMyPolicyProfile(accessToken: string) {
  const response = await requestWithAccessToken<{
    profile: {
      id: string;
      userId: string;
      riskThresholds: unknown;
    };
  }>("/policy/profiles/me", accessToken);

  return normalizePolicyProfile(response);
}

export function inferPolicyMode(profile: ExtensionPolicyProfile): ExtensionPolicyMode {
  const strictThresholds =
    profile.thresholds.criticalMinConfidence >= 0.85 &&
    profile.thresholds.highMinConfidence >= 0.75 &&
    profile.thresholds.mediumMinConfidence >= 0.65;
  const allAgentsEnabled =
    profile.enabledAgents.riskScanner &&
    profile.enabledAgents.missingClause &&
    profile.enabledAgents.ambiguity &&
    profile.enabledAgents.compliance &&
    profile.enabledAgents.crossClauseConflict;

  return strictThresholds && allAgentsEnabled ? "strict" : "personal";
}

export async function applyPolicyModePreset(
  accessToken: string,
  mode: ExtensionPolicyMode
) {
  const preset = mode === "strict" ? strictPreset : personalPreset;

  const response = await requestWithAccessToken<{
    profile: {
      id: string;
      userId: string;
      riskThresholds: unknown;
    };
  }>("/policy/profiles/me", accessToken, {
    method: "PUT",
    body: {
      thresholds: preset.thresholds,
      enabledAgents: preset.enabledAgents
    }
  });

  return normalizePolicyProfile(response);
}
