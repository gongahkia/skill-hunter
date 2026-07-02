import test from 'node:test';
import assert from 'node:assert/strict';
import { McqProvider } from '../providers/mcq-provider.js';

const questions = [
    {
        id: 'mcq-test-001',
        prompt: 'Which answer is correct?',
        choices: ['wrong', 'right'],
        answerIndex: 1,
        tags: ['test'],
        difficulty: 1,
        source: 'dorso-inhouse',
    },
];

test('McqProvider returns offline bundled challenges', async () => {
    const provider = new McqProvider({ questions });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    assert.equal(challenge.source, 'mcq');
    assert.equal(challenge.source_label, 'MCQ');
    assert.equal(challenge.slug, 'mcq-test-001');
    assert.equal(challenge.supports_verification, true);
    assert.equal(challenge.selection_mode, 'bundled_mcq');
});

test('McqProvider verifies answer indexes locally', async () => {
    const provider = new McqProvider({ questions });
    const challenge = await provider.getChallenge({ difficulty: 'easy' });

    assert.equal((await provider.verify(challenge, 1)).ok, true);
    assert.equal((await provider.verify(challenge, 0)).ok, false);
});
