import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeSolveMetricsState,
    recordFailedSolveAttempt,
    recordSolveMetric,
} from '../core/solve-metrics.js';

test('solve metrics track weekly attempts, failures, solves, and average time', () => {
    const date = '2026-07-02T10:00:00.000Z';
    let state = recordFailedSolveAttempt({}, { date });
    state = recordSolveMetric(state, { date, timeToSolveMs: 3000 });

    assert.equal(state.solvesThisWeek, 1);
    assert.equal(state.attemptsThisWeek, 2);
    assert.equal(state.failuresThisWeek, 1);
    assert.equal(state.averageTimeToSolveMs, 3000);
    assert.equal(state.failRate, 0.5);
});

test('solve metrics reset when the ISO week changes', () => {
    const state = recordSolveMetric({}, {
        date: '2026-07-02T10:00:00.000Z',
        timeToSolveMs: 3000,
    });
    const reset = normalizeSolveMetricsState(state, { date: '2026-07-09T10:00:00.000Z' });

    assert.equal(reset.solvesThisWeek, 0);
    assert.equal(reset.attemptsThisWeek, 0);
    assert.equal(reset.failuresThisWeek, 0);
    assert.equal(reset.averageTimeToSolveMs, 0);
    assert.equal(reset.failRate, 0);
});
