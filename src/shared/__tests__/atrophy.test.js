import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCognitiveIndex } from '../core/atrophy.js';

test('computeCognitiveIndex returns 100 for maxed healthy inputs', () => {
    assert.equal(computeCognitiveIndex({
        solvesInLast7d: 7,
        target7dSolves: 7,
        currentRun: 7,
        targetRunLength: 7,
        averageTimeToSolveMs: 0,
        failRate: 0,
        normalizedMedianTimeToSolveTrend: 0,
        sourceDiversityRatio: 1,
        bypassesThisWeek: 0,
    }), 100);
});

test('computeCognitiveIndex applies weighted components and bypass penalty', () => {
    assert.equal(computeCognitiveIndex({
        solvesInLast7d: 4,
        target7dSolves: 8,
        currentRun: 4,
        targetRunLength: 8,
        averageTimeToSolveMs: 150000,
        targetTimeToSolveMs: 300000,
        failRate: 0.25,
        sourceDiversityRatio: 0.5,
        bypassesThisWeek: 2,
    }), 45);
});

test('computeCognitiveIndex clamps malformed inputs', () => {
    assert.equal(computeCognitiveIndex({
        solvesInLast7d: Infinity,
        target7dSolves: 0,
        currentRun: Infinity,
        targetRunLength: 0,
        averageTimeToSolveMs: -10,
        targetTimeToSolveMs: 0,
        failRate: 2,
        normalizedMedianTimeToSolveTrend: -1,
        sourceDiversityRatio: 2,
        bypassesThisWeek: 1,
    }), 25);
});
