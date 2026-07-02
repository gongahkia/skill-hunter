import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBadgeSvg } from '../badge-svg.js';

test('renderBadgeSvg renders a serverless Cognitive Index badge', () => {
    const svg = renderBadgeSvg({
        cognitiveIndex: 87,
        longestRun: 14,
        generatedAt: '2026-07-02T00:00:00.000Z',
    });

    assert.match(svg, /^<svg /);
    assert.match(svg, /aria-label="Dorso Cognitive Index badge"/);
    assert.match(svg, />87</);
    assert.match(svg, />14</);
    assert.match(svg, />2026-07-02</);
});

test('renderBadgeSvg clamps score and run values', () => {
    const svg = renderBadgeSvg({
        cognitiveIndex: 150,
        longestRun: -5,
        generatedAt: '2026-07-02T00:00:00.000Z',
    });

    assert.match(svg, />100</);
    assert.match(svg, />0</);
});
