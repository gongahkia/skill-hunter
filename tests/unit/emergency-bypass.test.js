import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EMERGENCY_BYPASS_OPTIONS,
    getCurrentBypassWeekStart,
    getEmergencyBypassState,
    normalizeEmergencyBypassLimit,
} from '../../src/shared/core/emergency-bypass.js';

test('emergency bypass limit is range constrained', () => {
    assert.deepEqual(EMERGENCY_BYPASS_OPTIONS, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(normalizeEmergencyBypassLimit(0), 0);
    assert.equal(normalizeEmergencyBypassLimit(7), 7);
    assert.equal(normalizeEmergencyBypassLimit(8), 2);
    assert.equal(normalizeEmergencyBypassLimit('x'), 2);
});

test('emergency bypass week starts on monday UTC', () => {
    assert.equal(
        getCurrentBypassWeekStart(Date.UTC(2026, 5, 24, 12)),
        Date.UTC(2026, 5, 22),
    );
});

test('emergency bypass state resets on a new week', () => {
    const previousWeekStart = Date.UTC(2026, 5, 15);
    const now = Date.UTC(2026, 5, 24, 12);

    assert.deepEqual(getEmergencyBypassState({
        limit: 3,
        weekStart: previousWeekStart,
        used: 2,
        now,
    }), {
        limit: 3,
        weekStart: Date.UTC(2026, 5, 22),
        used: 0,
        remaining: 3,
    });
});

test('emergency bypass state preserves weekly use for cognitive index input', () => {
    const weekStart = Date.UTC(2026, 5, 22);

    assert.deepEqual(getEmergencyBypassState({
        limit: 2,
        weekStart,
        used: 3,
        now: Date.UTC(2026, 5, 24, 12),
    }), {
        limit: 2,
        weekStart,
        used: 3,
        remaining: 0,
    });
});
