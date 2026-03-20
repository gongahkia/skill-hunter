import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { evalSrc } from './helpers.js';

const { DomUtils } = evalSrc('dom-utils.js');

describe('DomUtils', () => {
  it('querySafe returns first matching selector', () => {
    const dom = new JSDOM('<div><span class="a">1</span><span class="b">2</span></div>');
    const doc = dom.window.document;
    const result = DomUtils.querySafe(doc, ['.nonexistent', '.a']);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe('1');
  });

  it('querySafe returns null when nothing matches', () => {
    const dom = new JSDOM('<div></div>');
    const result = DomUtils.querySafe(dom.window.document, ['.x', '.y']);
    expect(result).toBeNull();
  });

  it('querySafeAll returns first non-empty match', () => {
    const dom = new JSDOM('<div><p>1</p><p>2</p></div>');
    const result = DomUtils.querySafeAll(dom.window.document, ['.nope', 'p']);
    expect(result).toHaveLength(2);
    expect(result[0].textContent).toBe('1');
  });

  it('querySafeAll returns empty array when nothing matches', () => {
    const dom = new JSDOM('<div></div>');
    const result = DomUtils.querySafeAll(dom.window.document, ['.x']);
    expect(result).toEqual([]);
  });

  it('querySafe handles invalid selectors gracefully', () => {
    const dom = new JSDOM('<div class="ok">yes</div>');
    const result = DomUtils.querySafe(dom.window.document, ['[invalid=', '.ok']);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe('yes');
  });

  it('traverseShadow returns null if path breaks', () => {
    const dom = new JSDOM('<div></div>');
    const result = DomUtils.traverseShadow(dom.window.document, ['.missing', '.also-missing']);
    expect(result).toBeNull();
  });

  it('queryShadow returns empty array for non-existent shadow', () => {
    const dom = new JSDOM('<div></div>');
    const result = DomUtils.queryShadow(dom.window.document, ['.host'], '.inner');
    expect(result).toEqual([]);
  });
});
