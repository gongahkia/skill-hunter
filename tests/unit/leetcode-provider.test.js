import assert from 'node:assert/strict';
import test from 'node:test';
import { LeetCodeProvider } from '../../src/extension/lib/providers/leetcode-provider.js';

const challenges = [
    { slug: 'easy-one', title: 'Easy One', difficulty: 'Easy', topic_tags: ['array'] },
    { slug: 'hard-one', title: 'Hard One', difficulty: 'Hard', topic_tags: ['graph'] },
];

test('LeetCodeProvider filters by difficulty and recent slugs', async () => {
    const provider = new LeetCodeProvider({ challenges });
    const challenge = await provider.getChallenge({
        difficulty: 'hard',
        recentSlugs: [{ source: 'leetcode', slug: 'easy-one' }],
    });

    assert.equal(challenge.slug, 'hard-one');
    assert.equal(challenge.source, 'leetcode');
});

test('LeetCodeProvider verifies matching accepted submissions', async () => {
    const provider = new LeetCodeProvider({ challenges });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });
    const ok = await provider.verify(challenge, {
        source: 'leetcode',
        slug: challenge.slug,
        success: true,
    });
    const fail = await provider.verify(challenge, {
        source: 'leetcode',
        slug: 'other',
        success: true,
    });

    assert.equal(ok.ok, true);
    assert.equal(fail.ok, false);
    assert.equal(fail.expectedSlug, challenge.slug);
});
