import assert from 'node:assert/strict';
import test from 'node:test';
import { McqProvider } from '../../src/extension/lib/providers/mcq-provider.js';

const questions = [
    {
        id: 'mcq-easy-one',
        prompt: 'easy prompt',
        choices: ['a', 'b', 'c'],
        answerIndex: 1,
        tags: ['arrays'],
        difficulty: 1,
        source: 'dorso-inhouse',
    },
    {
        id: 'mcq-hard-one',
        prompt: 'hard prompt',
        choices: ['x', 'y', 'z'],
        answerIndex: 2,
        tags: ['graphs'],
        difficulty: 5,
        source: 'dorso-inhouse',
    },
];

test('McqProvider filters by recent slugs and difficulty', async () => {
    const provider = new McqProvider({ questions });
    const challenge = await provider.getChallenge({
        difficulty: 'hard',
        recentSlugs: [{ source: 'mcq', slug: 'mcq-easy-one' }],
    });

    assert.equal(challenge.slug, 'mcq-hard-one');
    assert.equal(challenge.source, 'mcq');
    assert.equal(challenge.source_label, 'MCQ');
    assert.equal(challenge.selection_mode, 'bundled_mcq');
});

test('McqProvider verifies strict answer index matches', async () => {
    const provider = new McqProvider({ questions });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });
    const ok = await provider.verify(challenge, 1);
    const stringFail = await provider.verify(challenge, '1');
    const wrongFail = await provider.verify(challenge, 2);

    assert.equal(ok.ok, true);
    assert.equal(stringFail.ok, false);
    assert.equal(wrongFail.ok, false);
    assert.equal(wrongFail.expectedSlug, challenge.slug);
    assert.equal(wrongFail.expectedSource, 'mcq');
});

test('McqProvider lazy-loads bundled MCQ data', async () => {
    const originalChrome = globalThis.chrome;
    const originalFetch = globalThis.fetch;
    globalThis.chrome = {
        runtime: {
            getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
        },
    };
    globalThis.fetch = async (url) => {
        assert.equal(url, 'chrome-extension://test/data/mcq.json');
        return {
            ok: true,
            async json() {
                return questions;
            },
        };
    };

    try {
        const provider = new McqProvider();
        const challenge = await provider.getChallenge({ difficulty: 'hard' });
        assert.equal(challenge.slug, 'mcq-hard-one');
    } finally {
        globalThis.chrome = originalChrome;
        globalThis.fetch = originalFetch;
    }
});
