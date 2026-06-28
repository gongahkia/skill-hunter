import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createBadgeEmbeds,
    createLeaderboardSubmission,
} from '../../src/extension/lib/badge-url.js';

function decodeBase64Url(value) {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64').toString('utf8');
}

test('createBadgeEmbeds returns signed markdown and html', async () => {
    const embeds = await createBadgeEmbeds({
        dashboardState: {
            installId: 'dorso-install-test',
            bypassesThisWeek: 1,
            longestRun: 4,
        },
        secret: 'test-secret',
        baseUrl: 'https://badge.example.test/',
        timestamp: 1782499200000,
    });

    assert.equal(embeds.available, true);
    assert.match(embeds.imageUrl, /^https:\/\/badge\.example\.test\/badge\/.+\.svg\?sig=.+/);
    assert.equal(embeds.markdown, `![Dorso Cognitive Index](${embeds.imageUrl})`);
    assert.equal(embeds.html, `<img src="${embeds.imageUrl}" alt="Dorso Cognitive Index">`);
    assert.equal(embeds.sig.length > 20, true);

    const decodedState = JSON.parse(decodeBase64Url(embeds.encodedState));
    assert.deepEqual(Object.keys(decodedState), ['score', 'longestRun', 'installIdHash', 'timestamp']);
    assert.equal(decodedState.score, 0);
    assert.equal(decodedState.longestRun, 4);
    assert.equal(decodedState.timestamp, 1782499200000);
    assert.equal(decodedState.installIdHash.length, 64);
});

test('createBadgeEmbeds reports unavailable without secret', async () => {
    const embeds = await createBadgeEmbeds({
        dashboardState: {},
        secret: '',
    });

    assert.deepEqual(embeds, {
        available: false,
        reason: 'Badge signing unavailable in this build.',
    });
});

test('createLeaderboardSubmission signs anonymous repo-scoped payload', async () => {
    const submission = await createLeaderboardSubmission({
        dashboardState: {
            installId: 'dorso-install-test',
            bypassesThisWeek: 0,
            longestRun: 9,
        },
        repoUrl: 'https://github.com/gongahkia/dorso.git',
        secret: 'test-secret',
        baseUrl: 'https://badge.example.test',
        timestamp: 1782499200000,
    });

    const body = JSON.parse(submission.body);
    assert.equal(submission.available, true);
    assert.match(submission.endpoint, new RegExp(`^https://badge\\.example\\.test/leaderboard/${body.repoHash}\\.json$`));
    assert.equal(body.repoHash.length, 64);
    assert.equal(body.installIdHash.length, 64);
    assert.equal(body.longestRun, 9);
    assert.equal(submission.sig.length > 20, true);
});
