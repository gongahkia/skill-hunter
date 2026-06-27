import assert from 'node:assert/strict';
import test from 'node:test';
import { createSolveShareText } from '../../src/extension/ui/share-text.js';

test('createSolveShareText formats receipt summary', () => {
    assert.equal(
        createSolveShareText({
            problemTitle: 'Two Sum',
            sourceLabel: 'MCQ',
            currentRun: 3,
        }),
        'Dorso unlocked after solving Two Sum on MCQ. Current run: 3.',
    );
});
