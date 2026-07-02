import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SOURCE_SELECTION_REQUIRED_MESSAGE,
    getSourceSelection,
} from '../source-selection.js';

test('getSourceSelection returns selected source ids', () => {
    assert.deepEqual(getSourceSelection(['mcq', 'drills']), {
        enabledSources: ['mcq', 'drills'],
        hasSelection: true,
        message: '',
    });
});

test('getSourceSelection returns recovery message when empty', () => {
    assert.deepEqual(getSourceSelection([]), {
        enabledSources: [],
        hasSelection: false,
        message: SOURCE_SELECTION_REQUIRED_MESSAGE,
    });
});
