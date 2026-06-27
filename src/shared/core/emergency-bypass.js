const DAY_MS = 24 * 60 * 60 * 1000;

export const EMERGENCY_BYPASSES_DEFAULT_PER_WEEK = 2;
export const EMERGENCY_BYPASS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

export function normalizeEmergencyBypassLimit(value) {
    const limit = Number(value);
    return Number.isInteger(limit) && EMERGENCY_BYPASS_OPTIONS.includes(limit)
        ? limit
        : EMERGENCY_BYPASSES_DEFAULT_PER_WEEK;
}

export function getCurrentBypassWeekStart(now = Date.now()) {
    const timestamp = Number(now);
    const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
    const dayOffset = (date.getUTCDay() + 6) % 7;
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return dayStart - (dayOffset * DAY_MS);
}

export function getEmergencyBypassState({
    limit,
    weekStart,
    used,
    now = Date.now(),
} = {}) {
    const safeLimit = normalizeEmergencyBypassLimit(limit);
    const currentWeekStart = getCurrentBypassWeekStart(now);
    const storedWeekStart = Number(weekStart);
    const storedUsed = Number(used);
    const usedThisWeek = storedWeekStart === currentWeekStart && Number.isFinite(storedUsed)
        ? Math.max(0, Math.trunc(storedUsed))
        : 0;

    return {
        limit: safeLimit,
        weekStart: currentWeekStart,
        used: usedThisWeek,
        remaining: Math.max(0, safeLimit - usedThisWeek),
    };
}
