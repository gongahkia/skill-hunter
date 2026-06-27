import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isTargetRuleActive,
    normalizePerTargetRules,
} from '../../src/shared/core/target-rules.js';

const targets = [{
    id: 'chatgpt',
    label: 'ChatGPT',
    hostnames: ['chatgpt.com'],
}];

test('target rules normalize per origin and filter unavailable sources', () => {
    const rules = normalizePerTargetRules({
        'https://chatgpt.com': {
            schedule: 'custom',
            customCron: '1-5 09:00-17:00',
            difficultyOverride: 'hard',
            sourcesOverride: ['mcq', 'aoc', 'euler'],
        },
        'https://unknown.test': {
            schedule: 'weekends',
        },
    }, {
        targets,
        availableSources: ['mcq', 'euler'],
    });

    assert.deepEqual(Object.keys(rules), ['https://chatgpt.com']);
    assert.deepEqual(rules['https://chatgpt.com'], {
        schedule: 'custom',
        customCron: '1-5 09:00-17:00',
        difficultyOverride: 'hard',
        sourcesOverride: ['mcq', 'euler'],
    });
});

test('target rule schedules evaluate fixed and custom windows', () => {
    const mondayMorning = new Date(2026, 5, 22, 10, 0);
    const mondayEvening = new Date(2026, 5, 22, 18, 0);
    const saturdayMorning = new Date(2026, 5, 27, 10, 0);

    assert.equal(isTargetRuleActive({ schedule: 'weekdays' }, mondayMorning), true);
    assert.equal(isTargetRuleActive({ schedule: 'weekdays' }, saturdayMorning), false);
    assert.equal(isTargetRuleActive({ schedule: 'weekends' }, saturdayMorning), true);
    assert.equal(isTargetRuleActive({
        schedule: 'custom',
        customCron: '1-5 09:00-17:00',
    }, mondayMorning), true);
    assert.equal(isTargetRuleActive({
        schedule: 'custom',
        customCron: '1-5 09:00-17:00',
    }, mondayEvening), false);
    assert.equal(isTargetRuleActive({
        schedule: 'custom',
        customCron: 'not cron',
    }, mondayEvening), true);
});
