export const AI_FAST_DURATION_HOURS = [24, 168, 720];
export const DEFAULT_AI_FAST_STATE = {
    active: false,
    durationHours: 24,
    startedAt: '',
    plannedSummary: {
        solves: 0,
        drillsCompleted: 0,
    },
};

function getValidDurationHours(value) {
    const durationHours = Number(value);
    return AI_FAST_DURATION_HOURS.includes(durationHours) ? durationHours : DEFAULT_AI_FAST_STATE.durationHours;
}

function getValidStartedAt(value) {
    if (typeof value !== 'string' || !value) {
        return '';
    }

    return Number.isFinite(Date.parse(value)) ? value : '';
}

function normalizeSummary(value) {
    return {
        solves: Math.max(0, Math.trunc(Number(value?.solves || 0))),
        drillsCompleted: Math.max(0, Math.trunc(Number(value?.drillsCompleted || 0))),
    };
}

function getEndTimestamp(startedAt, durationHours) {
    if (!startedAt) {
        return 0;
    }

    return Date.parse(startedAt) + (durationHours * 60 * 60 * 1000);
}

function formatIcsDate(date) {
    return date.toISOString()
        .replaceAll('-', '')
        .replaceAll(':', '')
        .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value) {
    return String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll(';', '\\;')
        .replaceAll(',', '\\,')
        .replaceAll('\n', '\\n');
}

export function normalizeAiFastState(value, now = Date.now()) {
    const durationHours = getValidDurationHours(value?.durationHours);
    const startedAt = getValidStartedAt(value?.startedAt);
    const endsAtMs = getEndTimestamp(startedAt, durationHours);
    const isActive = Boolean(value?.active && startedAt && now < endsAtMs);

    return {
        active: isActive,
        durationHours,
        startedAt,
        endsAt: startedAt ? new Date(endsAtMs).toISOString() : '',
        remainingMs: isActive ? Math.max(0, endsAtMs - now) : 0,
        plannedSummary: normalizeSummary(value?.plannedSummary),
    };
}

export function createAiFastState(durationHours, now = Date.now()) {
    return {
        active: true,
        durationHours: getValidDurationHours(durationHours),
        startedAt: new Date(now).toISOString(),
        plannedSummary: {
            solves: 0,
            drillsCompleted: 0,
        },
    };
}

export function recordAiFastSolve(value, challenge, now = Date.now()) {
    const state = normalizeAiFastState(value, now);
    if (!state.active) {
        return {
            active: false,
            durationHours: state.durationHours,
            startedAt: state.startedAt,
            plannedSummary: state.plannedSummary,
        };
    }

    return {
        active: true,
        durationHours: state.durationHours,
        startedAt: state.startedAt,
        plannedSummary: {
            solves: state.plannedSummary.solves + 1,
            drillsCompleted: state.plannedSummary.drillsCompleted + (challenge?.source === 'drills' ? 1 : 0),
        },
    };
}

export function createAiFastCalendar(state, exportedAt = new Date()) {
    const normalizedState = normalizeAiFastState(state, Date.parse(exportedAt.toISOString()));
    if (!normalizedState.startedAt) {
        throw new Error('No AI fast has been started.');
    }

    const startedAt = new Date(normalizedState.startedAt);
    const endsAt = new Date(normalizedState.endsAt);
    const summary = normalizedState.plannedSummary;
    const description = [
        `Solves: ${summary.solves}`,
        `Drills completed: ${summary.drillsCompleted}`,
    ].join('\n');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Dorso//AI Fast//EN',
        'BEGIN:VEVENT',
        `UID:dorso-ai-fast-${startedAt.getTime()}@dorso.local`,
        `DTSTAMP:${formatIcsDate(exportedAt)}`,
        `DTSTART:${formatIcsDate(startedAt)}`,
        `DTEND:${formatIcsDate(endsAt)}`,
        'SUMMARY:Dorso AI fast',
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ].join('\r\n');
}
