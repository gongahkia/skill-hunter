import assert from 'node:assert/strict';
import test from 'node:test';
import {
    COGNITIVE_INDEX_LABEL,
    computeCognitiveIndex,
} from '../../src/shared/core/atrophy.js';

test('computeCognitiveIndex composes weighted score', () => {
    assert.equal(computeCognitiveIndex({
        solvesInLast7d: 7,
        target7dSolves: 7,
        normalizedMedianTimeToSolveTrend: 0,
        sourceDiversityRatio: 1,
    }), 100);
});

test('computeCognitiveIndex clamps bounds and bypass penalty', () => {
    assert.equal(computeCognitiveIndex({
        solvesInLast7d: 999,
        target7dSolves: 7,
        normalizedMedianTimeToSolveTrend: -2,
        sourceDiversityRatio: 9,
        bypassesThisWeek: 1,
    }), 95);

    assert.equal(computeCognitiveIndex({
        solvesInLast7d: 0,
        normalizedMedianTimeToSolveTrend: 1,
        sourceDiversityRatio: 0,
        bypassesThisWeek: 3,
    }), 0);
});

test('computeCognitiveIndex empty data is zero and label is stable', () => {
    assert.equal(computeCognitiveIndex(), 0);
    assert.equal(COGNITIVE_INDEX_LABEL, 'Cognitive Index');
});
