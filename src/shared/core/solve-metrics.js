const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_SOLVE_METRICS = Object.freeze({
    weekKey: '',
    solvesThisWeek: 0,
    attemptsThisWeek: 0,
    failuresThisWeek: 0,
    totalSolveTimeMs: 0,
    averageTimeToSolveMs: 0,
    failRate: 0,
});

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

function getIsoWeekKey(value = new Date()) {
    const date = new Date(dateToUtcMs(toIsoDate(value)));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / MS_PER_DAY) + 1) / 7);
    return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function finiteCount(value) {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function finiteMs(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function withDerivedFields(state) {
    const solvesThisWeek = finiteCount(state.solvesThisWeek);
    const attemptsThisWeek = finiteCount(state.attemptsThisWeek);
    const failuresThisWeek = Math.min(finiteCount(state.failuresThisWeek), attemptsThisWeek);
    const totalSolveTimeMs = finiteMs(state.totalSolveTimeMs);

    return {
        weekKey: state.weekKey || '',
        solvesThisWeek,
        attemptsThisWeek,
        failuresThisWeek,
        totalSolveTimeMs,
        averageTimeToSolveMs: solvesThisWeek > 0 ? Math.round(totalSolveTimeMs / solvesThisWeek) : 0,
        failRate: attemptsThisWeek > 0 ? failuresThisWeek / attemptsThisWeek : 0,
    };
}

export function createSolveMetricsState({ date = new Date() } = {}) {
    return {
        ...DEFAULT_SOLVE_METRICS,
        weekKey: getIsoWeekKey(date),
    };
}

export function normalizeSolveMetricsState(state = {}, { date = new Date() } = {}) {
    const currentWeekKey = getIsoWeekKey(date);
    if (!state || state.weekKey !== currentWeekKey) {
        return createSolveMetricsState({ date });
    }

    return withDerivedFields(state);
}

export function recordSolveMetric(state = {}, {
    date = new Date(),
    timeToSolveMs = 0,
} = {}) {
    const normalized = normalizeSolveMetricsState(state, { date });
    return withDerivedFields({
        ...normalized,
        solvesThisWeek: normalized.solvesThisWeek + 1,
        attemptsThisWeek: normalized.attemptsThisWeek + 1,
        totalSolveTimeMs: normalized.totalSolveTimeMs + finiteMs(timeToSolveMs),
    });
}

export function recordFailedSolveAttempt(state = {}, { date = new Date() } = {}) {
    const normalized = normalizeSolveMetricsState(state, { date });
    return withDerivedFields({
        ...normalized,
        attemptsThisWeek: normalized.attemptsThisWeek + 1,
        failuresThisWeek: normalized.failuresThisWeek + 1,
    });
}
