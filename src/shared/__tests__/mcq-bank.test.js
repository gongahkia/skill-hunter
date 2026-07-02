import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const questions = JSON.parse(readFileSync(new URL('../data/mcq.json', import.meta.url), 'utf8'));

const requiredTopicPrefixes = {
    'Big-O': 'mcq-big-o-',
    'OS basics': 'mcq-os-basics-',
    networking: 'mcq-networking-',
    SQL: 'mcq-sql-',
    regex: 'mcq-regex-',
    recursion: 'mcq-recursion-',
    'dynamic programming': 'mcq-dynamic-programming-',
};

test('MCQ bank ships 200+ unique questions with valid answer indexes', () => {
    assert.ok(questions.length >= 200);
    assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);

    questions.forEach((question) => {
        assert.ok(question.answerIndex >= 0);
        assert.ok(question.answerIndex < question.choices.length);
    });
});

test('MCQ bank covers requested topic packs', () => {
    Object.entries(requiredTopicPrefixes).forEach(([topic, prefix]) => {
        const count = questions.filter((question) => question.id.startsWith(prefix)).length;
        assert.ok(count >= 10, `${topic} has ${count} questions`);
    });
});
