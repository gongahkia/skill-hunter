export const TARGET_RULE_SCHEDULES = ['always', 'weekdays', 'weekends', 'custom'];
export const TARGET_RULE_DIFFICULTIES = ['default', 'easy', 'medium', 'hard'];
export const DEFAULT_TARGET_RULE = {
    schedule: 'always',
    customCron: '* 00:00-23:59',
    difficultyOverride: 'default',
    sourcesOverride: [],
};

function unique(values) {
    return [...new Set(values)];
}

function normalizeSchedule(value) {
    return TARGET_RULE_SCHEDULES.includes(value) ? value : DEFAULT_TARGET_RULE.schedule;
}

function normalizeDifficulty(value) {
    return TARGET_RULE_DIFFICULTIES.includes(value) ? value : DEFAULT_TARGET_RULE.difficultyOverride;
}

function normalizeCustomCron(value) {
    const customCron = typeof value === 'string' ? value.trim() : '';
    return customCron || DEFAULT_TARGET_RULE.customCron;
}

function getAllowedOrigins(targets) {
    return targets
        .map((target) => getTargetOrigin(target))
        .filter(Boolean);
}

export function getTargetOrigin(target) {
    const hostname = target?.hostnames?.[0];
    return hostname ? `https://${hostname}` : '';
}

export function normalizeTargetRule(value, availableSources = []) {
    const allowedSources = new Set(availableSources);
    const sourcesOverride = Array.isArray(value?.sourcesOverride)
        ? unique(value.sourcesOverride.filter((sourceId) => allowedSources.has(sourceId)))
        : [];

    return {
        schedule: normalizeSchedule(value?.schedule),
        customCron: normalizeCustomCron(value?.customCron),
        difficultyOverride: normalizeDifficulty(value?.difficultyOverride),
        sourcesOverride,
    };
}

export function normalizePerTargetRules(value, { targets = [], availableSources = [] } = {}) {
    const rules = {};
    getAllowedOrigins(targets).forEach((origin) => {
        rules[origin] = normalizeTargetRule(value?.[origin], availableSources);
    });
    return rules;
}

export function getRuleForTarget(perTargetRules, target, availableSources = []) {
    const origin = getTargetOrigin(target);
    return normalizeTargetRule(perTargetRules?.[origin], availableSources);
}

function parseTime(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
        return null;
    }
    return (Number(match[1]) * 60) + Number(match[2]);
}

function expandDays(value) {
    if (value === '*') {
        return new Set([0, 1, 2, 3, 4, 5, 6]);
    }

    const days = new Set();
    for (const segment of value.split(',')) {
        const range = /^([0-6])-([0-6])$/.exec(segment);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            if (start > end) {
                return null;
            }
            for (let day = start; day <= end; day += 1) {
                days.add(day);
            }
            continue;
        }

        if (/^[0-6]$/.test(segment)) {
            days.add(Number(segment));
            continue;
        }

        return null;
    }

    return days.size ? days : null;
}

function isWithinWindow(nowMinutes, startMinutes, endMinutes) {
    if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }

    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function isCustomCronActive(customCron, date) {
    const match = /^(\*|[0-6](?:-[0-6])?(?:,[0-6](?:-[0-6])?)*)\s+([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)$/.exec(customCron);
    if (!match) {
        return true;
    }

    const days = expandDays(match[1]);
    const startMinutes = parseTime(match[2]);
    const endMinutes = parseTime(match[3]);
    if (!days || startMinutes === null || endMinutes === null) {
        return true;
    }

    const nowMinutes = (date.getHours() * 60) + date.getMinutes();
    return days.has(date.getDay()) && isWithinWindow(nowMinutes, startMinutes, endMinutes);
}

export function isTargetRuleActive(rule, date = new Date()) {
    const normalizedRule = normalizeTargetRule(rule);
    if (normalizedRule.schedule === 'always') {
        return true;
    }

    const day = date.getDay();
    if (normalizedRule.schedule === 'weekdays') {
        return day >= 1
            && day <= 5
            && isCustomCronActive(normalizedRule.customCron, date);
    }

    if (normalizedRule.schedule === 'weekends') {
        return day === 0 || day === 6;
    }

    return isCustomCronActive(normalizedRule.customCron, date);
}
