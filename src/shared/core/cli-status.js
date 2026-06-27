import { computeCognitiveIndex } from './atrophy.js';

export const DEFAULT_CLI_STATUS_EXPORT_PATH = 'dorso/status.json';

export function normalizeCliStatusExportPath(value) {
    const candidate = String(value || DEFAULT_CLI_STATUS_EXPORT_PATH)
        .trim()
        .replaceAll('\\', '/')
        .replace(/^\/+/, '');

    if (!candidate || /^[a-z]:\//i.test(candidate)) {
        return DEFAULT_CLI_STATUS_EXPORT_PATH;
    }

    const parts = candidate.split('/').filter(Boolean);
    if (!parts.length || parts.some((part) => part === '.' || part === '..')) {
        return DEFAULT_CLI_STATUS_EXPORT_PATH;
    }

    return parts.join('/');
}

function getStatusKind(state) {
    if (state?.isPaused) {
        return 'paused';
    }
    if (state?.hasActiveSession) {
        return 'unlocked';
    }
    return 'locked';
}

function getChallengeSummary(challenge) {
    if (!challenge) {
        return null;
    }

    return {
        source: challenge.source,
        sourceLabel: challenge.source_label || challenge.source,
        slug: challenge.slug,
        title: challenge.title,
        difficulty: challenge.difficulty,
        url: challenge.url || '',
    };
}

export function createCliStatusSnapshot(state, { exportedAt = new Date().toISOString(), installIdHash = '' } = {}) {
    const enabledSources = Array.isArray(state?.enabledSources) ? state.enabledSources : [];
    const cognitiveIndex = computeCognitiveIndex({
        solvesInLast7d: Number(state?.currentRun || 0),
        sourceDiversityRatio: new Set(enabledSources).size > 1 ? 1 : 0,
        bypassesThisWeek: Number(state?.bypassesThisWeek || 0),
    });

    return {
        schemaVersion: 1,
        exportedAt,
        status: getStatusKind(state),
        cognitiveIndex,
        installIdHash,
        session: {
            isActive: Boolean(state?.hasActiveSession),
            expiresAt: state?.session?.expiresAt || null,
            timeRemainingMs: Math.max(0, Number(state?.session?.timeRemaining || 0)),
        },
        challenge: getChallengeSummary(state?.currentChallenge),
        currentRun: Number(state?.currentRun || 0),
        longestRun: Number(state?.longestRun || 0),
        graceDaysRemaining: Number(state?.graceDaysRemaining || 0),
        bypassesThisWeek: Number(state?.bypassesThisWeek || 0),
        enabledSources,
    };
}
