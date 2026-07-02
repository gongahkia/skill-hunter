import test from 'node:test';
import assert from 'node:assert/strict';
import { EulerProvider, sha256Hex } from '../providers/euler-provider.js';

test('EulerProvider verifies formatted numeric answers locally', async () => {
    const provider = new EulerProvider({
        answers: [{
            id: 'pe-999',
            url: 'https://projecteuler.net/problem=999',
            answerHash: await sha256Hex('1234567'),
            difficulty: 1,
            tags: ['math'],
        }],
    });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    assert.equal(challenge.source, 'euler');
    assert.equal(challenge.selection_mode, 'link_out_hash');
    assert.equal((await provider.verify(challenge, ' 1,234 567 ')).ok, true);
    assert.equal((await provider.verify(challenge, 'answer: 1234567')).ok, false);
});
