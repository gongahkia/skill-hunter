import test from 'node:test';
import assert from 'node:assert/strict';
import { DrillsProvider } from '../providers/drills-provider.js';

const drills = [
    {
        id: 'drill-test-map',
        prompt: 'Type the map callback.',
        expected: 'array.map((value) => value)',
        language: 'javascript',
        normalizers: ['whitespace', 'semicolons'],
        threshold: 2,
        tags: ['javascript', 'arrays'],
        difficulty: 1,
    },
    {
        id: 'drill-test-filter',
        prompt: 'Type the filter callback.',
        expected: 'array.filter((value) => value)',
        language: 'javascript',
        normalizers: ['whitespace', 'semicolons'],
        threshold: 2,
        tags: ['javascript', 'arrays'],
        difficulty: 1,
    },
];

test('DrillsProvider returns offline type-from-memory challenges', async () => {
    const provider = new DrillsProvider({ drills });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    assert.equal(challenge.source, 'drills');
    assert.equal(challenge.source_label, 'Drills');
    assert.equal(challenge.language, 'javascript');
    assert.equal(challenge.supports_verification, true);
});

test('DrillsProvider avoids recent slugs', async () => {
    const provider = new DrillsProvider({ drills });
    const challenge = await provider.getChallenge({
        difficulty: 'easy',
        recentSlugs: [{ source: 'drills', slug: 'drill-test-map' }],
    });

    assert.equal(challenge.slug, 'drill-test-filter');
});

test('DrillsProvider accepts exact and near answers but rejects wrong answers', async () => {
    const provider = new DrillsProvider({ drills: [drills[0]] });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    assert.equal((await provider.verify(challenge, 'array.map((value) => value);')).ok, true);
    assert.equal((await provider.verify(challenge, 'array.map((value) => valu)')).ok, true);
    assert.equal((await provider.verify(challenge, 'fetch(url)')).ok, false);
});
