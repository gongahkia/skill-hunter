import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolveShareText } from '../share-text.js';

test('createSolveShareText includes receipt details', () => {
    assert.equal(
        createSolveShareText({
            problemTitle: 'Binary Search',
            sourceLabel: 'MCQ',
            currentRun: 4,
        }),
        'Dorso unlocked after solving Binary Search on MCQ. Current run: 4.',
    );
});

test('createSolveShareText falls back and clamps run count', () => {
    assert.equal(
        createSolveShareText({ currentRun: -2 }),
        'Dorso unlocked after solving a coding challenge on Dorso. Current run: 0.',
    );
});
