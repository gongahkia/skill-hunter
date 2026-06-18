import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadFixture } from './helpers.js';

function html(name) {
  return new JSDOM(loadFixture('fixtures/imports/google-docs/' + name)).window.document;
}

function fixture(name) {
  return loadFixture('fixtures/imports/google-docs/' + name);
}

describe('Google Docs exported fixtures', () => {
  it('cover rich HTML export structures', () => {
    const doc = html('rich-doc.html');

    expect(doc.querySelectorAll('h1,h2')).toHaveLength(2);
    expect(doc.querySelectorAll('ul li')).toHaveLength(2);
    expect(doc.querySelectorAll('ol li')).toHaveLength(2);
    expect(doc.querySelector('a[href="https://example.test/source"]').textContent).toBe('source brief');
    expect(doc.querySelectorAll('table tr')).toHaveLength(3);
    expect(doc.querySelector('img').getAttribute('alt')).toBe('architecture diagram');
    expect(doc.querySelector('.comment').textContent).toContain('tighten privacy copy');
    expect(doc.querySelector('#fn1').textContent).toContain('Exported footnote text');
    expect(doc.body.textContent).toContain('TODO: review launch copy');
  });

  it('cover empty and long HTML exports', () => {
    expect(html('empty-doc.html').body.textContent.trim()).toBe('');

    const longDoc = html('long-doc.html');
    expect(longDoc.querySelectorAll('p')).toHaveLength(26);
    expect(longDoc.body.textContent).toContain('PROMPT: summarize long Docs import behavior');
  });

  it('cover plain text fallback', () => {
    const text = fixture('plain.txt');

    expect(text).toContain('Plain Docs export fixture');
    expect(text).toContain('TODO: parse plain text fallback');
  });

  it('cover DOCX document XML fallback structures', () => {
    const xml = fixture('docx-document.xml');

    expect(xml).toContain('Heading1');
    expect(xml).toContain('TODO: parse DOCX fallback');
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:drawing/>');
    expect(xml).toContain('<w:footnoteReference');
  });

  it('records coverage in the fixture manifest', () => {
    const manifest = JSON.parse(fixture('manifest.json'));
    const coverage = new Set(manifest.fixtures.flatMap((item) => item.coverage));

    ['heading', 'bulleted-list', 'numbered-list', 'link', 'table', 'footnote', 'image-placeholder', 'comment', 'long-doc', 'empty-doc'].forEach((item) => {
      expect(coverage.has(item)).toBe(true);
    });
  });
});
