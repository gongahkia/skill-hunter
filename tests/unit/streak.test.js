import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createStreakState,
    pauseStreak,
    recordSolve,
} from '../../src/shared/core/streak.js';

test('recordSolve starts and extends current and longest run', () => {
    let state = createStreakState();
    state = recordSolve(state, { date: '2026-06-01' });
    state = recordSolve(state, { date: '2026-06-02' });

    assert.equal(state.currentRun, 2);
    assert.equal(state.longestRun, 2);
    assert.equal(state.graceDaysRemaining, 1);
});

test('recordSolve consumes grace day before breaking', () => {
    let state = createStreakState({ graceDaysPerWeek: 1 });
    state = recordSolve(state, { date: '2026-06-01', graceDaysPerWeek: 1 });
    state = recordSolve(state, { date: '2026-06-03', graceDaysPerWeek: 1 });

    assert.equal(state.currentRun, 2);
    assert.equal(state.graceDaysRemaining, 0);

    state = recordSolve(state, { date: '2026-06-05', graceDaysPerWeek: 1 });
    assert.equal(state.currentRun, 1);
    assert.equal(state.longestRun, 2);
});

test('recordSolve resets grace days on ISO week boundary', () => {
    let state = createStreakState({ graceDaysPerWeek: 1 });
    state = recordSolve(state, { date: '2026-06-05', graceDaysPerWeek: 1 });
    state = recordSolve(state, { date: '2026-06-07', graceDaysPerWeek: 1 });
    state = recordSolve(state, { date: '2026-06-09', graceDaysPerWeek: 1 });

    assert.equal(state.currentRun, 3);
    assert.equal(state.graceDaysRemaining, 0);
});

test('pauseStreak prevents vacation gap from breaking run', () => {
    let state = createStreakState();
    state = recordSolve(state, { date: '2026-06-01' });
    state = pauseStreak(state, '2026-06-10', { date: '2026-06-01' });
    state = recordSolve(state, { date: '2026-06-10' });

    assert.equal(state.currentRun, 2);
    assert.equal(state.longestRun, 2);
});
