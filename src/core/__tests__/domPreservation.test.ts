import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLegislationContent, getLegislationDefinitions, getPageBasicData } from '../domParser';
import { generateContentHTML, integrateDefinitions } from '../contentProcessor';

const fixture = readFileSync(
  resolve(__dirname, '../../../tests/fixtures/legislation.html'),
  'utf8'
);

function render(): HTMLDivElement {
  const tokens = getLegislationContent();
  integrateDefinitions(tokens, getLegislationDefinitions());
  const rendered = document.createElement('div');
  rendered.innerHTML = generateContentHTML(tokens);
  return rendered;
}

describe('legislative source preservation', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fixture;
  });

  it('preserves all legislative text exactly once and in source order', () => {
    const original = document.getElementById('legisContent')?.textContent;
    const rendered = render();
    expect(rendered.textContent).toBe(original);
    expect(rendered.querySelectorAll('br')).toHaveLength(2);
  });

  it('preserves links, subsection anchors, nested tables, and schedule list hierarchy', () => {
    const rendered = render();
    expect(rendered.querySelector('a[href="https://example.org/other?x=1&y=2"]')?.textContent).toBe(
      'the linked instrument'
    );
    expect(rendered.querySelector('[id="pr3-ss1-"]')?.textContent).toBe(
      '(1) Every person must retain A&B records.'
    );
    expect(rendered.querySelector('ol[type="a"]')?.children).toHaveLength(2);
    expect(rendered.querySelectorAll('table table')).toHaveLength(1);
    expect(rendered.querySelector('h2.section-header[id="pr3-he-"]')?.textContent).toBe(
      '3. Duties'
    );
  });

  it('extracts Unicode and entity terms, and attaches decoded definitions without changing text', () => {
    const rendered = render();
    const terms = Array.from(rendered.querySelectorAll('.statute-term'));
    expect(terms.some((term) => term.textContent === 'A&B')).toBe(true);
    expect(terms.some((term) => term.textContent === 'café')).toBe(true);
    expect(
      terms.find((term) => term.textContent === 'person')?.getAttribute('data-skill-hunter-tooltip')
    ).toBe('“person” includes a company and an individual;');
  });

  it('reads TOC labels in a standards DOM without innerText', () => {
    expect(
      getPageBasicData().pageBasicData.tableOfContents.map((entry) => entry.referenceText)
    ).toEqual(['1 Short title', '2 Interpretation', '3 Duties', 'FIRST SCHEDULE']);
  });

  it('preserves unfamiliar classes and refuses an absent legislative root', () => {
    document.querySelector('.prov1Txt')?.setAttribute('class', 'future-layout prov1Txt extra');
    expect(render().textContent).toContain('This Act is the Synthetic Test Act 2026.');
    document.getElementById('legisContent')?.remove();
    expect(() => getLegislationContent()).toThrow();
  });

  it('does not interpret source text as markup when no definitions exist', () => {
    document.querySelectorAll('.def').forEach((node) => node.remove());
    const body = document.querySelector('.prov1Txt');
    if (!body) throw new Error('fixture missing body');
    body.textContent = '<img src=x onerror="window.injected=true"> & ___SH_TERM_0___';
    const rendered = render();
    expect(rendered.querySelector('img')).toBeNull();
    expect(rendered.textContent).toContain(
      '<img src=x onerror="window.injected=true"> & ___SH_TERM_0___'
    );
  });

  it('removes active markup and unsafe URL schemes while retaining visible statutory text', () => {
    const body = document.querySelector('.prov1Txt');
    if (!body) throw new Error('fixture missing body');
    body.innerHTML =
      '<svg onload="alert(1)"><text>Diagram label</text></svg>' +
      '<a href="javascript:alert(1)" onclick="alert(2)">Unsafe link label</a>' +
      '<script>window.injected=true</script><iframe src="https://example.org"></iframe>' +
      '<span data-skill-hunter-action="close" style="position:fixed">Ordinary text</span>';
    const rendered = render();
    expect(
      rendered.querySelector(
        'svg, script, iframe, [onclick], [onload], [style], [data-skill-hunter-action]'
      )
    ).toBeNull();
    expect(rendered.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(rendered.textContent).toContain('Diagram labelUnsafe link labelOrdinary text');
  });

  it('matches complete decoded Unicode terms without placeholder collisions or repeated escaping', () => {
    const body = document.querySelector('.prov1Txt');
    if (!body) throw new Error('fixture missing body');
    body.textContent = 'café décafé A&B ___SH_TERM_0___ person';
    const tokens = getLegislationContent();
    integrateDefinitions(tokens, getLegislationDefinitions());
    integrateDefinitions(tokens, getLegislationDefinitions());
    const rendered = document.createElement('div');
    rendered.innerHTML = generateContentHTML(tokens);
    expect(rendered.textContent).toContain('café décafé A&B ___SH_TERM_0___ person');
    expect(
      Array.from(rendered.querySelectorAll('.statute-term'), (node) => node.textContent)
    ).not.toContain('décafé');
    expect(rendered.querySelector('.statute-term .statute-term')).toBeNull();
  });

  it('links only existing in-document section references without adding hidden preview text', () => {
    const body = document.querySelector('.prov1Txt');
    if (!body) throw new Error('fixture missing body');
    body.textContent = 'Refer to section 2 and section 999.';
    const rendered = render();
    expect(
      rendered.querySelector('button[data-skill-hunter-scroll-target="pr2-he-"]')?.textContent
    ).toBe('section 2');
    expect(rendered.querySelector('[data-skill-hunter-scroll-target="pr999-he-"]')).toBeNull();
    expect(rendered.textContent).toContain('Refer to section 2 and section 999.');
  });

  it('does not apply ambiguous definitions from different provisions', () => {
    const definition = document.querySelector('.def');
    const other = definition?.cloneNode(true);
    if (!(other instanceof HTMLElement)) throw new Error('fixture missing definition');
    other.textContent = '“person” means only an individual in this Part;';
    definition?.after(other);
    expect(
      getLegislationDefinitions().some((pair) =>
        Object.prototype.hasOwnProperty.call(pair, 'person')
      )
    ).toBe(false);
  });
});
