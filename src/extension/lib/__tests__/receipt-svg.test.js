import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReceiptSvg } from '../receipt-svg.js';

test('renderReceiptSvg renders receipt metrics and solve time', () => {
    const svg = renderReceiptSvg({
        problemTitle: 'Binary Search',
        sourceLabel: 'MCQ',
        timeToSolveMs: 123000,
        currentRun: 4,
        cognitiveIndex: 72,
    });

    assert.match(svg, /^<svg /);
    assert.match(svg, /aria-label="Dorso solve receipt"/);
    assert.match(svg, /Binary Search/);
    assert.match(svg, /MCQ \/ 2m 03s/);
    assert.match(svg, />4</);
    assert.match(svg, />72</);
});

test('renderReceiptSvg escapes user-controlled text', () => {
    const svg = renderReceiptSvg({
        problemTitle: '<script>alert(1)</script>',
        sourceLabel: 'A&B',
    });

    assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(svg, /A&amp;B/);
});
