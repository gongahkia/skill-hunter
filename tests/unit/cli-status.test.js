import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCliStatusSnapshot,
    normalizeCliStatusExportPath,
} from '../../src/shared/core/cli-status.js';

test('CLI status export path normalizes unsafe filenames', () => {
    assert.equal(normalizeCliStatusExportPath('dorso/status.json'), 'dorso/status.json');
    assert.equal(normalizeCliStatusExportPath('/tmp/status.json'), 'tmp/status.json');
    assert.equal(normalizeCliStatusExportPath('../status.json'), 'dorso/status.json');
    assert.equal(normalizeCliStatusExportPath('C:\\tmp\\status.json'), 'dorso/status.json');
});

test('CLI status snapshot redacts install id and computes prompt score', () => {
    const snapshot = createCliStatusSnapshot({
        installId: 'raw-install-id',
        hasActiveSession: true,
        session: {
            expiresAt: '2026-06-27T01:00:00.000Z',
            timeRemaining: 60000,
        },
        currentChallenge: {
            source: 'mcq',
            source_label: 'MCQ',
            slug: 'binary-search',
            title: 'Binary Search',
            difficulty: 'Easy',
            url: '',
        },
        currentRun: 3,
        longestRun: 5,
        graceDaysRemaining: 1,
        bypassesThisWeek: 0,
        enabledSources: ['mcq', 'drills'],
    }, {
        exportedAt: '2026-06-27T00:00:00.000Z',
        installIdHash: 'hash',
    });

    assert.equal(snapshot.status, 'unlocked');
    assert.equal(snapshot.installIdHash, 'hash');
    assert.equal(Object.hasOwn(snapshot, 'installId'), false);
    assert.equal(snapshot.cognitiveIndex > 0, true);
    assert.equal(snapshot.challenge.title, 'Binary Search');
});
