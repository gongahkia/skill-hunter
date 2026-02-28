import type { FindingSeverity, FindingStatus, LlmProvider } from "./client";

export interface FindingStateItem {
  id: string;
  status: FindingStatus;
  severity: FindingSeverity;
  title: string;
  summary: string;
  confidence: number | null;
  updatedAt: string;
}

export interface FindingStateModel {
  ids: string[];
  byId: Record<string, FindingStateItem>;
  countsByStatus: Record<FindingStatus, number>;
}

export interface PolicyProfileStateItem {
  id: string;
  name: string;
  defaultProvider: LlmProvider;
  enabledAgents: string[];
  thresholds: {
    criticalMinConfidence: number;
    highMinConfidence: number;
    mediumMinConfidence: number;
    autoEscalateSeverity: "critical" | "high" | "medium";
  };
  updatedAt: string;
}

export interface PolicyProfileStateModel {
  ids: string[];
  byId: Record<string, PolicyProfileStateItem>;
  activeProfileId: string | null;
}

const FINDING_STATUS_KEYS: FindingStatus[] = [
  "open",
  "accepted",
  "dismissed",
  "needs-edit"
];

function createInitialFindingCounts() {
  return {
    open: 0,
    accepted: 0,
    dismissed: 0,
    "needs-edit": 0
  } satisfies Record<FindingStatus, number>;
}

export function buildFindingStateModel(findings: FindingStateItem[]): FindingStateModel {
  const byId: Record<string, FindingStateItem> = {};
  const ids: string[] = [];
  const countsByStatus = createInitialFindingCounts();

  for (const finding of findings) {
    const existingFinding = byId[finding.id];

    if (!existingFinding) {
      ids.push(finding.id);
    } else {
      countsByStatus[existingFinding.status] = Math.max(0, countsByStatus[existingFinding.status] - 1);
    }

    byId[finding.id] = finding;
    countsByStatus[finding.status] += 1;
  }

  return {
    ids,
    byId,
    countsByStatus
  };
}

export function upsertFindingInState(
  model: FindingStateModel,
  finding: FindingStateItem
): FindingStateModel {
  const previous = model.byId[finding.id];
  const byId = {
    ...model.byId,
    [finding.id]: finding
  };
  const ids = previous ? model.ids : [...model.ids, finding.id];
  const countsByStatus = {
    ...model.countsByStatus
  };

  if (previous) {
    countsByStatus[previous.status] = Math.max(0, countsByStatus[previous.status] - 1);
  }
  countsByStatus[finding.status] += 1;

  return {
    ids,
    byId,
    countsByStatus
  };
}

export function removeFindingFromState(model: FindingStateModel, findingId: string): FindingStateModel {
  const existing = model.byId[findingId];
  if (!existing) {
    return model;
  }

  const byId = { ...model.byId };
  delete byId[findingId];

  const ids = model.ids.filter((id) => id !== findingId);
  const countsByStatus = {
    ...model.countsByStatus
  };
  countsByStatus[existing.status] = Math.max(0, countsByStatus[existing.status] - 1);

  return {
    ids,
    byId,
    countsByStatus
  };
}

export function selectFindingsByStatus(model: FindingStateModel, status: FindingStatus) {
  return model.ids
    .map((id) => model.byId[id])
    .filter((finding): finding is FindingStateItem => Boolean(finding && finding.status === status));
}

export function hasBlockingFindings(model: FindingStateModel) {
  return model.countsByStatus.open > 0 || model.countsByStatus["needs-edit"] > 0;
}

export function buildPolicyProfileStateModel(
  profiles: PolicyProfileStateItem[],
  activeProfileId?: string | null
): PolicyProfileStateModel {
  const byId: Record<string, PolicyProfileStateItem> = {};
  const ids: string[] = [];

  for (const profile of profiles) {
    if (!byId[profile.id]) {
      ids.push(profile.id);
    }

    byId[profile.id] = profile;
  }

  const resolvedActiveId =
    activeProfileId && byId[activeProfileId] ? activeProfileId : ids[0] ?? null;

  return {
    ids,
    byId,
    activeProfileId: resolvedActiveId
  };
}

export function upsertPolicyProfileInState(
  model: PolicyProfileStateModel,
  profile: PolicyProfileStateItem
): PolicyProfileStateModel {
  const hasExistingProfile = Boolean(model.byId[profile.id]);
  const ids = hasExistingProfile ? model.ids : [...model.ids, profile.id];

  return {
    ids,
    byId: {
      ...model.byId,
      [profile.id]: profile
    },
    activeProfileId: model.activeProfileId ?? profile.id
  };
}

export function setActivePolicyProfile(
  model: PolicyProfileStateModel,
  profileId: string | null
): PolicyProfileStateModel {
  if (profileId !== null && !model.byId[profileId]) {
    return model;
  }

  return {
    ...model,
    activeProfileId: profileId
  };
}

export function listPolicyProfiles(model: PolicyProfileStateModel) {
  return model.ids
    .map((id) => model.byId[id])
    .filter((profile): profile is PolicyProfileStateItem => Boolean(profile));
}

export function validateFindingStateModel(model: FindingStateModel) {
  const recomputedCounts = createInitialFindingCounts();

  for (const status of FINDING_STATUS_KEYS) {
    recomputedCounts[status] = 0;
  }

  for (const findingId of model.ids) {
    const finding = model.byId[findingId];
    if (!finding) {
      return false;
    }
    recomputedCounts[finding.status] += 1;
  }

  return FINDING_STATUS_KEYS.every(
    (status) => recomputedCounts[status] === model.countsByStatus[status]
  );
}
