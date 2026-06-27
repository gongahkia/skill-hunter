import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getDigestEntries,
    renderDigestMarkdown,
    renderDigestSvg,
} from '../../src/extension/lib/digest-svg.js';

test('getDigestEntries keeps only the last 7 days', () => {
    const now = Date.parse('2026-06-27T00:00:00Z');
    const entries = [
        { timestamp: now - 1000, target: 'chatgpt', text: 'fresh' },
        { timestamp: now - (8 * 24 * 60 * 60 * 1000), target: 'claude', text: 'old' },
    ];

    assert.deepEqual(getDigestEntries(entries, now).map((entry) => entry.text), ['fresh']);
});

test('renderDigestSvg groups entries by target and escapes text', () => {
    const svg = renderDigestSvg({
        generatedAt: Date.parse('2026-06-27T00:00:00Z'),
        dorsoWordmark: '<Dorso>',
        entries: [
            { timestamp: 1, target: 'chatgpt', text: 'a' },
            { timestamp: 2, target: 'chatgpt', text: 'b' },
            { timestamp: 3, target: 'A&B', text: 'c' },
        ],
    });

    assert.match(svg, /&lt;Dorso&gt;/);
    assert.match(svg, /chatgpt: 2/);
    assert.match(svg, /A&amp;B: 1/);
});

test('renderDigestMarkdown emits grouped markdown', () => {
    const markdown = renderDigestMarkdown([
        { timestamp: 1, target: 'chatgpt', text: 'Prompt one' },
    ]);

    assert.match(markdown, /# Dorso weekly digest/);
    assert.match(markdown, /## chatgpt/);
    assert.match(markdown, /Prompt one/);
});
