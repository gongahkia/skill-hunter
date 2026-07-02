import test from 'node:test';
import assert from 'node:assert/strict';
import { AocProvider, normalizeAocAnswerHashes, sha256Hex } from '../providers/aoc-provider.js';
import { STORAGE_KEYS } from '../../../shared/core/constants.js';

const originalBrowser = globalThis.browser;
const originalChrome = globalThis.chrome;

test('normalizeAocAnswerHashes keeps only supported answer hashes', () => {
    assert.deepEqual(normalizeAocAnswerHashes({
        'AOC-2023-01-PART-1': 'A'.repeat(64),
        invalid: 'nope',
    }), {
        'aoc-2023-01-part-1': 'a'.repeat(64),
    });
});

test('AocProvider verifies formatted local numeric answers', async () => {
    const slug = 'aoc-2023-01-part-1';
    const answerHash = await sha256Hex('1234567');
    globalThis.browser = undefined;
    globalThis.chrome = {
        runtime: {},
        storage: {
            local: {
                get() {
                    return Promise.resolve({
                        [STORAGE_KEYS.AOC_ANSWER_HASHES]: {
                            [slug]: answerHash,
                        },
                    });
                },
            },
        },
    };

    const provider = new AocProvider({
        problems: [{
            id: slug,
            year: 2023,
            day: 1,
            part: 1,
            url: 'https://adventofcode.com/2023/day/1',
            difficulty: 1,
            tags: ['advent-of-code'],
        }],
    });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    try {
        assert.equal(challenge.source, 'aoc');
        assert.equal(challenge.selection_mode, 'aoc_session_or_hash');
        assert.equal((await provider.verify(challenge, { answer: '1_234_567' })).ok, true);
        assert.equal((await provider.verify(challenge, { answer: 'answer: 1234567' })).ok, false);
    } finally {
        globalThis.browser = originalBrowser;
        globalThis.chrome = originalChrome;
    }
});
