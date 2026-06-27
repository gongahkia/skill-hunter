import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReceiptSvg } from '../../src/extension/lib/receipt-svg.js';

test('renderReceiptSvg returns stable receipt SVG shape', () => {
    const svg = renderReceiptSvg({
        problemTitle: 'Two Sum',
        sourceLabel: 'LeetCode',
        timeToSolveMs: 65000,
        currentRun: 3,
        dorsoWordmark: 'Dorso',
        cognitiveIndex: 87,
    });

    assert.match(svg, /viewBox="0 0 800 400"/);
    assert.match(svg, />Two Sum</);
    assert.match(svg, />LeetCode \/ 1m 05s</);
    assert.match(svg, />3</);
    assert.match(svg, />87</);
});

test('renderReceiptSvg escapes text and clamps numeric fields', () => {
    const svg = renderReceiptSvg({
        problemTitle: '<script>',
        sourceLabel: 'A&B',
        timeToSolveMs: -1,
        currentRun: -2,
        cognitiveIndex: 999,
    });

    assert.match(svg, /&lt;script&gt;/);
    assert.match(svg, /A&amp;B/);
    assert.match(svg, /A&amp;B \/ 0s/);
    assert.match(svg, />0</);
    assert.match(svg, />100</);
});
