import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumericAnswer } from '../core/numeric-answer.js';

test('normalizeNumericAnswer removes safe numeric separators', () => {
    assert.equal(normalizeNumericAnswer(' 1,234 567_890 '), '1234567890');
    assert.equal(normalizeNumericAnswer('-1,024'), '-1024');
});

test('normalizeNumericAnswer leaves nonnumeric text unchanged', () => {
    assert.equal(normalizeNumericAnswer('answer: 42'), 'answer: 42');
});
