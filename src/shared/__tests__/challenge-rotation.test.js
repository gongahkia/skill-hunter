import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getChallengeFromEnabledProviders,
    getProviderRotationOrder,
    recordRecentChallenge,
} from '../core/challenge-rotation.js';

test('getProviderRotationOrder rotates enabled sources from random offset', () => {
    assert.deepEqual(
        getProviderRotationOrder(['mcq', 'drills', 'leetcode'], 0.4),
        ['drills', 'leetcode', 'mcq'],
    );
});

test('getChallengeFromEnabledProviders falls back after provider failure', async () => {
    const challenge = await getChallengeFromEnabledProviders({
        enabledSources: ['leetcode', 'mcq'],
        randomValue: 0,
        providers: {
            leetcode: {
                async getChallenge() {
                    throw new Error('LeetCode unavailable');
                },
            },
            mcq: {
                async getChallenge() {
                    return { source: 'mcq', slug: 'mcq-1' };
                },
            },
        },
    });

    assert.deepEqual(challenge, { source: 'mcq', slug: 'mcq-1' });
});

test('recordRecentChallenge deduplicates source/slug pairs and caps window', () => {
    assert.deepEqual(
        recordRecentChallenge([
            { source: 'mcq', slug: 'old', timestamp: 1 },
            { source: 'mcq', slug: 'repeat', timestamp: 2 },
            { source: 'drills', slug: 'other', timestamp: 3 },
        ], { source: 'mcq', slug: 'repeat' }, {
            timestamp: 4,
            windowSize: 2,
        }),
        [
            { source: 'mcq', slug: 'repeat', timestamp: 4 },
            { source: 'mcq', slug: 'old', timestamp: 1 },
        ],
    );
});
