import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Annotations } from '../annotations';
import { actAliases, caseUrl, detectReferences } from '../references';
import { extractDefinitions, definitionFor } from '../definitions';
import {
  contentRoot,
  localTarget,
  pageSummary,
  parseHtml,
  provisionText,
  searchCandidates,
} from '../sources';
import { ANNOTATION_ATTR } from '@/utils/constants';
const url = 'https://sso.agc.gov.sg/Act/Test2026?WholeDoc=1';
function fixture(): HTMLElement {
  document.documentElement.innerHTML = readFileSync(
    resolve(__dirname, '../../../tests/fixtures/legislation.html'),
    'utf8'
  );
  return contentRoot(document) as HTMLElement;
}
describe('inline reference preservation', () => {
  it('keeps source text, elements, anchors, tables and event handlers through repeated toggles', () => {
    const root = fixture();
    const original = root.textContent;
    const originalElements = Array.from(root.querySelectorAll('*'));
    const link = root.querySelector('a') as HTMLAnchorElement;
    const handler = jest.fn();
    link.addEventListener('click', handler);
    for (let n = 0; n < 3; n++) {
      const annotations = new Annotations(root, url);
      annotations.scan();
      expect(root.textContent).toBe(original);
      expect(root.querySelectorAll(`[${ANNOTATION_ATTR}]`).length).toBeGreaterThan(0);
      expect(originalElements.every((el) => el.isConnected)).toBe(true);
      link.dispatchEvent(new MouseEvent('click', { cancelable: true }));
      annotations.clear();
      expect(root.textContent).toBe(original);
      expect(root.querySelector(`[${ANNOTATION_ATTR}]`)).toBeNull();
    }
    expect(handler).toHaveBeenCalledTimes(3);
  });
  it('recognises references across inline markup without moving original elements', () => {
    const root = fixture();
    const body = root.querySelector('.prov1Txt') as HTMLElement;
    body.innerHTML = 'Read <em>section 5(1)</em> of the <strong>Misuse of Drugs Act 1973</strong>.';
    const em = body.querySelector('em');
    const strong = body.querySelector('strong');
    const annotations = new Annotations(root, url);
    annotations.scan();
    const spans = Array.from(body.querySelectorAll(`[${ANNOTATION_ATTR}]`));
    expect(spans).toHaveLength(3);
    expect(spans.every((el) => annotations.reference(el)?.kind === 'statute')).toBe(true);
    expect(body.querySelector('em')).toBe(em);
    expect(body.querySelector('strong')).toBe(strong);
    annotations.clear();
    expect(body.innerHTML).toBe(
      'Read <em>section 5(1)</em> of the <strong>Misuse of Drugs Act 1973</strong>.'
    );
  });
  it('decorates native links without replacing them or adding a tab stop inside them', () => {
    const root = fixture();
    const a = root.querySelector('a') as HTMLAnchorElement;
    const href = a.getAttribute('href');
    new Annotations(root, url).scan();
    expect(a.getAttribute('href')).toBe(href);
    expect(a.querySelector(`[${ANNOTATION_ATTR}]`)).not.toBeNull();
    expect(a.querySelector('[tabindex]')).toBeNull();
  });
  it('does not annotate editable, hidden or interactive content and does not duplicate on rescans', () => {
    const root = fixture();
    root.insertAdjacentHTML(
      'beforeend',
      '<p contenteditable="true">SGCA</p><button>SGHC</button><p hidden>SLR</p><p id="new">SGCA</p>'
    );
    const annotations = new Annotations(root, url);
    annotations.scan();
    const count = root.querySelectorAll(`[${ANNOTATION_ATTR}]`).length;
    annotations.scan();
    expect(root.querySelectorAll(`[${ANNOTATION_ATTR}]`)).toHaveLength(count);
    expect(root.querySelector('[contenteditable] span, button span, [hidden] span')).toBeNull();
    const p = document.createElement('p');
    p.textContent = 'SGHC(A)';
    root.append(p);
    annotations.scan();
    expect(p.querySelector(`[${ANNOTATION_ATTR}]`)).not.toBeNull();
    annotations.clear();
  });
});
describe('reference resolution boundaries', () => {
  it('parses neutral citations including appellate and international court codes', () => {
    expect(caseUrl('[2024] SGCA 12')).toBe('https://www.elitigation.sg/gd/s/2024_SGCA_12');
    expect(caseUrl('[2025] SGHC(A) 14')).toContain('2025_SGHCA_14');
    expect(caseUrl('[2025] 1 SLR 12')).toBeUndefined();
  });
  it('resolves explicit Act aliases and retains cited historical edition', () => {
    const root = fixture();
    const p = document.createElement('p');
    p.textContent = 'Arbitration Act 2001 (2020 Rev Ed) (the “AA”). Read s 21(9) of the AA.';
    root.append(p);
    expect(actAliases(root).get('AA')).toBe('Arbitration Act 2001');
    expect(detectReferences('s 21(9) of the AA', p, root, url)[0]?.reference.act).toBe(
      'Arbitration Act 2001'
    );
    const match = detectReferences(
      'section 5 of the Misuse of Drugs Act 1973 (2008 Rev Ed)',
      p,
      root,
      url
    )[0];
    expect(match?.reference.version).toBe('2008 Rev Ed');
    expect(match?.reference.section).toBe('5');
  });
  it('does not mistake an external provision for the same-numbered local section', () => {
    const root = fixture();
    const results = detectReferences('section 2 of the Unknown Act 2026', root, root, url);
    expect(results).toHaveLength(1);
    expect(results[0]?.reference.kind).toBe('statute');
    expect(results[0]?.reference.url).toBeUndefined();
    expect(detectReferences('section 999', root, root, url)).toHaveLength(0);
  });
  it('preserves local subsection targets and provision text without including the next heading', () => {
    const root = fixture();
    const target = localTarget(root, '3(1)');
    expect(target?.id).toBe('pr3-ss1-');
    expect(provisionText(localTarget(root, '2') as Element)).toContain('Interpretation');
    expect(provisionText(localTarget(root, '2') as Element)).not.toContain('3. Duties');
  });
  it('uses specific scopes and refuses conflicting definitions', () => {
    const root = fixture();
    const body = root.querySelector('[id="pr3-ss1-"]') as Element;
    let defs = extractDefinitions(root);
    expect(definitionFor('person', body, root, defs)?.text).toContain('company');
    root
      .querySelector('.def')
      ?.insertAdjacentHTML(
        'afterend',
        '<tr><td class="def">“person” means something else;</td></tr>'
      );
    defs = extractDefinitions(root);
    expect(definitionFor('person', body, root, defs)).toBeUndefined();
  });
  it('keeps part definitions out of other Parts', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="partHdr">PART I</td></tr><tr><td id="pr1-he-">Interpretation</td></tr><tr><td>In this Part —</td></tr><tr><td class="def">“term” means the first Part;</td></tr><tr><td id="inside">term</td></tr><tr><td class="partHdr">PART II</td></tr><tr><td id="outside">term</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const defs = extractDefinitions(root);
    expect(
      definitionFor('term', document.getElementById('inside') as Element, root, defs)
    ).toBeDefined();
    expect(
      definitionFor('term', document.getElementById('outside') as Element, root, defs)
    ).toBeUndefined();
  });
  it('extracts judgment metadata, public search links and strips fetched active markup', () => {
    const doc = parseHtml(
      '<div id="divJudgement"><div class="HN-NeutralCit">[2024] SGCA 12</div><div class="HN-CaseName">Example v Other</div><div class="HN-Coram">Court of Appeal — Appeal 1<br>Judges</div><div class="Judg-Date-Reserved">2 May 2024</div></div><a href="/gdviewer/s/2024_SGCA_12">Example v Other</a><script>alert(1)</script><img src="https://evil.test/pixel">'
    );
    const summary = pageSummary(doc, 'https://www.elitigation.sg/gd/s/2024_SGCA_12');
    expect(summary.title).toBe('Example v Other');
    expect(summary.court).toBe('Court of Appeal');
    expect(summary.date).toBe('2 May 2024');
    expect(doc.querySelector('script,img')).toBeNull();
    expect(searchCandidates(doc, 'https://www.elitigation.sg/gdviewer/Home/Index')[0]?.url).toBe(
      'https://www.elitigation.sg/gd/s/2024_SGCA_12'
    );
  });
});
it('keeps whitespace-only nodes when detecting citations split across elements', () => {
  const root = fixture();
  const body = root.querySelector('.prov1Txt') as HTMLElement;
  body.innerHTML = '<em>section</em> <b>5</b> of the <i>Misuse of Drugs Act 1973</i>';
  const original = body.textContent;
  const annotations = new Annotations(root, url);
  annotations.scan();
  expect(body.textContent).toBe(original);
  expect(body.querySelector('[data-skill-hunter-reference]')).not.toBeNull();
  annotations.clear();
  expect(body.textContent).toBe(original);
});
it('keeps explicit alias editions and offers remote term lookups only with identified scope', () => {
  document.body.innerHTML =
    '<div id="divJudgement"><p>Misuse of Drugs Act 1973 (2008 Rev Ed) (the “MDA”).</p><p id="reference">A person under s 5 of the MDA.</p></div>';
  const root = contentRoot(document) as HTMLElement;
  const paragraph = document.getElementById('reference') as HTMLElement;
  const refs = detectReferences(
    paragraph.textContent ?? '',
    paragraph,
    root,
    'https://www.elitigation.sg/gd/s/2024_SGCA_12'
  );
  expect(refs.find((r) => r.reference.kind === 'statute')?.reference.version).toBe('2008 Rev Ed');
  expect(refs.find((r) => r.reference.kind === 'definition')?.reference).toMatchObject({
    act: 'Misuse of Drugs Act 1973',
    section: '5',
    version: '2008 Rev Ed',
  });
  expect(
    detectReferences('property', paragraph, root, 'https://www.elitigation.sg/gd/s/2024_SGCA_12')
  ).toHaveLength(0);
});
it('uses a native external link’s section label when its URL has no hash', () => {
  const root = fixture();
  const a = document.createElement('a');
  a.href = 'https://sso.agc.gov.sg/Act/MDA1973?ProvIds=pr5-';
  a.textContent = 'section 5(1)';
  root.append(a);
  const ref = detectReferences(a.textContent, a, root, url)[0]?.reference;
  expect(ref).toMatchObject({ kind: 'statute', section: '5(1)' });
  expect(a.href).toContain('ProvIds=pr5-');
});
