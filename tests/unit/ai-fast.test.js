import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAiFastCalendar,
    createAiFastState,
    normalizeAiFastState,
    recordAiFastSolve,
} from '../../src/shared/core/ai-fast.js';

test('AI fast state tracks active window and expiry', () => {
    const start = Date.parse('2026-06-27T00:00:00.000Z');
    const state = createAiFastState(24, start);

    assert.equal(normalizeAiFastState(state, start + 1000).active, true);
    assert.equal(normalizeAiFastState(state, start + (25 * 60 * 60 * 1000)).active, false);
});

test('AI fast solve summary counts solves and drills', () => {
    const start = Date.parse('2026-06-27T00:00:00.000Z');
    const first = recordAiFastSolve(createAiFastState(24, start), { source: 'drills' }, start + 1000);
    const second = recordAiFastSolve(first, { source: 'mcq' }, start + 2000);

    assert.deepEqual(second.plannedSummary, {
        solves: 2,
        drillsCompleted: 1,
    });
});

test('AI fast calendar exports solved summary', () => {
    const state = {
        active: false,
        durationHours: 24,
        startedAt: '2026-06-27T00:00:00.000Z',
        plannedSummary: {
            solves: 3,
            drillsCompleted: 2,
        },
    };
    const ics = createAiFastCalendar(state, new Date('2026-06-28T00:00:00.000Z'));

    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.match(ics, /DTSTART:20260627T000000Z/);
    assert.match(ics, /DTEND:20260628T000000Z/);
    assert.match(ics, /DESCRIPTION:Solves: 3\\nDrills completed: 2/);
});
