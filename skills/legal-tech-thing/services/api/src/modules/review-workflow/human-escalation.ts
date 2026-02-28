export type HumanEscalationConfig = {
  enabled: boolean;
  minConfidence: number;
};

const DEFAULT_MIN_CONFIDENCE = 0.6;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseConfidence(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

export function resolveHumanEscalationConfig(riskThresholds: unknown): HumanEscalationConfig {
  const root = asRecord(riskThresholds) ?? {};
  const thresholds = asRecord(root.thresholds) ?? {};
  const mediumMinConfidence = parseConfidence(
    thresholds.mediumMinConfidence,
    DEFAULT_MIN_CONFIDENCE
  );

  const escalationSettings =
    asRecord(root.humanEscalation) ??
    asRecord(thresholds.humanEscalation) ??
    {};

  return {
    enabled:
      typeof escalationSettings.enabled === "boolean"
        ? escalationSettings.enabled
        : false,
    minConfidence: parseConfidence(
      escalationSettings.minConfidence,
      mediumMinConfidence
    )
  };
}

export function toConfidenceNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
}
