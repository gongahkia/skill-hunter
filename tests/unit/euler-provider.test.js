import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EulerProvider,
    sha256Hex,
} from '../../src/extension/lib/providers/euler-provider.js';

const answers = [
    {
        id: 'pe-001',
        url: 'https://projecteuler.net/problem=1',
        answerHash: await sha256Hex('42'),
        difficulty: 1,
        tags: ['math'],
    },
    {
        id: 'pe-050',
        url: 'https://projecteuler.net/problem=50',
        answerHash: await sha256Hex('9001'),
        difficulty: 5,
        tags: ['primes'],
    },
];

test('EulerProvider filters by recent slugs and difficulty', async () => {
    const provider = new EulerProvider({ answers });
    const challenge = await provider.getChallenge({
        recentSlugs: [{ source: 'euler', slug: 'pe-001' }],
        difficulty: 'hard',
    });

    assert.equal(challenge.slug, 'pe-050');
    assert.equal(challenge.source, 'euler');
    assert.equal(challenge.source_label, 'Project Euler');
    assert.equal(challenge.selection_mode, 'link_out_hash');
    assert.equal(challenge.answerHash, undefined);
});

test('EulerProvider verifies trimmed answer hashes', async () => {
    const provider = new EulerProvider({ answers });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });
    const ok = await provider.verify(challenge, ' 42 ');
    const fail = await provider.verify(challenge, '43');

    assert.equal(ok.ok, true);
    assert.equal(fail.ok, false);
    assert.equal(fail.expectedSource, 'euler');
});

test('EulerProvider lazy-loads bundled answer hashes', async () => {
    const originalChrome = globalThis.chrome;
    const originalFetch = globalThis.fetch;
    globalThis.chrome = {
        runtime: {
            getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
        },
    };
    globalThis.fetch = async (url) => {
        assert.equal(url, 'chrome-extension://test/data/euler-answers.json');
        return {
            ok: true,
            async json() {
                return answers;
            },
        };
    };

    try {
        const provider = new EulerProvider();
        const challenge = await provider.getChallenge({ difficulty: 'hard' });
        assert.equal(challenge.slug, 'pe-050');
    } finally {
        globalThis.chrome = originalChrome;
        globalThis.fetch = originalFetch;
    }
});
