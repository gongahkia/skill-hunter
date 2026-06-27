const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_GRACE_DAYS_PER_WEEK = 1;
export const MAX_GRACE_DAYS_PER_WEEK = 3;
export const STREAK_STATE = Object.freeze({
    currentRun: 0,
    longestRun: 0,
    graceDaysRemaining: DEFAULT_GRACE_DAYS_PER_WEEK,
    pausedUntil: null,
    lastSolveDate: null,
});

function clampGraceDays(value) {
    if (!Number.isFinite(value)) {
        return DEFAULT_GRACE_DAYS_PER_WEEK;
    }

    return Math.min(MAX_GRACE_DAYS_PER_WEEK, Math.max(0, Math.trunc(value)));
}

function toIsoDate(value = new Date()) {
    if (typeof value === 'string') {
        return value.slice(0, 10);
    }

    return value.toISOString().slice(0, 10);
}

function dateToUtcMs(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

function daysBetween(startIsoDate, endIsoDate) {
    return Math.round((dateToUtcMs(endIsoDate) - dateToUtcMs(startIsoDate)) / MS_PER_DAY);
}

function getIsoWeekKey(isoDate) {
    const date = new Date(dateToUtcMs(isoDate));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / MS_PER_DAY) + 1) / 7);
    return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function resetGraceIfNeeded(state, dateIso, graceDaysPerWeek) {
    if (!state.lastSolveDate || getIsoWeekKey(state.lastSolveDate) === getIsoWeekKey(dateIso)) {
        return state;
    }

    return {
        ...state,
        graceDaysRemaining: graceDaysPerWeek,
    };
}

export function createStreakState({ graceDaysPerWeek = DEFAULT_GRACE_DAYS_PER_WEEK } = {}) {
    return {
        ...STREAK_STATE,
        graceDaysRemaining: clampGraceDays(graceDaysPerWeek),
    };
}

export function normalizeStreakState(state = {}, {
    date = new Date(),
    graceDaysPerWeek = DEFAULT_GRACE_DAYS_PER_WEEK,
} = {}) {
    const weeklyGraceDays = clampGraceDays(graceDaysPerWeek);
    const normalized = {
        currentRun: Math.max(0, Math.trunc(state.currentRun ?? 0)),
        longestRun: Math.max(0, Math.trunc(state.longestRun ?? 0)),
        graceDaysRemaining: clampGraceDays(state.graceDaysRemaining ?? weeklyGraceDays),
        pausedUntil: state.pausedUntil || null,
        lastSolveDate: state.lastSolveDate || null,
    };

    return resetGraceIfNeeded(normalized, toIsoDate(date), weeklyGraceDays);
}

export function pauseStreak(state, pausedUntil, options = {}) {
    return {
        ...normalizeStreakState(state, options),
        pausedUntil: pausedUntil ? toIsoDate(pausedUntil) : null,
    };
}

export function recordSolve(state = {}, {
    date = new Date(),
    graceDaysPerWeek = DEFAULT_GRACE_DAYS_PER_WEEK,
} = {}) {
    const dateIso = toIsoDate(date);
    const normalized = normalizeStreakState(state, { date: dateIso, graceDaysPerWeek });
    const lastSolveDate = normalized.lastSolveDate;

    if (!lastSolveDate) {
        return {
            ...normalized,
            currentRun: 1,
            longestRun: Math.max(1, normalized.longestRun),
            lastSolveDate: dateIso,
        };
    }

    const gapDays = daysBetween(lastSolveDate, dateIso);
    if (gapDays <= 0) {
        return {
            ...normalized,
            longestRun: Math.max(normalized.currentRun, normalized.longestRun),
            lastSolveDate: dateIso,
        };
    }

    const paused = normalized.pausedUntil && normalized.pausedUntil >= dateIso;
    const missedDays = paused ? 0 : Math.max(0, gapDays - 1);
    const canContinue = gapDays === 1 || missedDays <= normalized.graceDaysRemaining;
    const currentRun = canContinue ? normalized.currentRun + 1 : 1;
    const graceDaysRemaining = canContinue
        ? Math.max(0, normalized.graceDaysRemaining - missedDays)
        : normalized.graceDaysRemaining;

    return {
        ...normalized,
        currentRun,
        longestRun: Math.max(currentRun, normalized.longestRun),
        graceDaysRemaining,
        lastSolveDate: dateIso,
    };
}
