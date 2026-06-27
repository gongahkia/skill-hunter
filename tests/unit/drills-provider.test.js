import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DrillsProvider,
    applyNormalizers,
    levenshteinDistance,
} from '../../src/extension/lib/providers/drills-provider.js';

const drills = [
    {
        id: 'easy-one',
        prompt: 'easy',
        expected: 'const x = "a"',
        normalizers: ['whitespace', 'quotes', 'semicolons'],
        threshold: 0,
        tags: ['javascript'],
        difficulty: 1,
    },
    {
        id: 'hard-one',
        prompt: 'hard',
        expected: 'ABC',
        normalizers: ['casing'],
        threshold: 0,
        tags: ['strings'],
        difficulty: 5,
    },
];

test('applyNormalizers handles whitespace quotes semicolons and casing', () => {
    assert.equal(applyNormalizers("  const x = 'a';  ", ['whitespace', 'quotes', 'semicolons']), 'const x = "a"');
    assert.equal(applyNormalizers('ABC', ['casing']), 'abc');
});

test('levenshteinDistance counts edits', () => {
    assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
});

test('DrillsProvider filters by recent slugs and difficulty', async () => {
    const provider = new DrillsProvider({ drills });
    const challenge = await provider.getChallenge({
        recentSlugs: [{ source: 'drills', slug: 'easy-one' }],
        difficulty: 'hard',
    });

    assert.equal(challenge.slug, 'hard-one');
});

test('DrillsProvider verifies normalized submissions', async () => {
    const provider = new DrillsProvider({ drills });
    const ok = await provider.verify({ ...drills[0], slug: drills[0].id }, " const x = 'a'; ");
    const fail = await provider.verify({ ...drills[0], slug: drills[0].id }, 'wrong');

    assert.equal(ok.ok, true);
    assert.equal(fail.ok, false);
    assert.equal(fail.expectedSource, 'drills');
});
