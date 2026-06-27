import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatHumanStatus,
    formatPromptStatus,
    formatStatus,
    parseStatusArgs,
} from '../../cli/lib/status.js';

const status = {
    status: 'locked',
    cognitiveIndex: 87,
    currentRun: 3,
    longestRun: 5,
    session: {
        isActive: false,
    },
    challenge: {
        title: 'Binary Search',
    },
};

test('CLI formats prompt and human status', () => {
    assert.equal(formatPromptStatus(status), 'DRS:87');
    assert.equal(formatHumanStatus(status), 'Dorso locked | CI 87 | run 3/5 | Binary Search');
    assert.equal(formatStatus(status, 'json'), JSON.stringify(status));
});

test('CLI parses status flags', () => {
    assert.deepEqual(parseStatusArgs(['status', '--prompt', '--watch', '--path', '/tmp/dorso.json'], {}), {
        command: 'status',
        mode: 'prompt',
        watch: true,
        path: '/tmp/dorso.json',
        help: false,
        version: false,
    });
});
