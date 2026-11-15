import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Annotations } from '../annotations';
import { actAliases, caseUrl, detectReferences } from '../references';
import { extractDefinitions, definitionFor } from '../definitions';
import {
  contentRoot,
  localPreview,
  localTarget,
  pageSummary,
  parseHtml,
  provisionText,
  searchCandidates,
  sectionContext,
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
  it('keeps defined words in SSO section headings plain while annotating their body text', () => {
    const root = fixture();
    const heading = document.getElementById('pr3-he-') as HTMLElement;
    heading.textContent = 'Duties of a person';
    const annotations = new Annotations(root, url);
    annotations.scan();
    expect(heading.querySelector(`[${ANNOTATION_ATTR}]`)).toBeNull();
    const body = document.getElementById('pr3-ss1-') as HTMLElement;
    const trigger = body.querySelector(`[${ANNOTATION_ATTR}]`) as Element;
    expect(annotations.reference(trigger)?.kind).toBe('definition');
    expect(trigger.textContent).toBe('person');
    annotations.clear();
  });
  it('resolves current SSO heading anchors, section context and enclosing-section fallbacks', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr1-"><span class="noBold"></span><span>Short title</span></td></tr><tr><td class="prov1Txt">First provision.</td></tr><tr><td class="prov1Hdr" id="pr2-"><span class="noBold"></span><span>Interpretation</span></td></tr><tr><td class="prov1Txt" id="reference">Read section 1.</td></tr><tr><td class="prov2Hdr" id="pr3-">Next section</td></tr><tr><td class="prov2Txt">Unrelated provision.</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const body = document.getElementById('reference') as HTMLElement;
    const target = localTarget(root, '2(9)') as Element;
    expect(target?.id).toBe('pr2-');
    expect(sectionContext(body)).toBe('2');
    expect(provisionText(target)).toContain('Interpretation');
    expect(provisionText(target)).not.toContain('Next section');
    expect(localPreview(target, 'subsection (9)', url).detail).toContain('Enclosing section');
    const reference = detectReferences(body.textContent ?? '', body, root, url)[0]?.reference;
    expect(reference?.kind).toBe('local');
    expect(reference?.target).toBe(document.getElementById('pr1-'));
  });
  it('keeps current SSO section-scoped definitions inside their section', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr2-">Interpretation</td></tr><tr><td>In this section —</td></tr><tr><td class="def">“person” means the fixture individual;</td></tr><tr><td id="inside">person</td></tr><tr><td class="prov2Hdr" id="pr3-">Other provision</td></tr><tr><td id="outside">person</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const defs = extractDefinitions(root);
    expect(defs[0]?.scope).toBe('section:2');
    expect(
      definitionFor('person', document.getElementById('inside') as Element, root, defs)
    ).toBeDefined();
    expect(
      definitionFor('person', document.getElementById('outside') as Element, root, defs)
    ).toBeUndefined();
  });
  it('extracts nested SSO definitions and annotates their use in later Parts', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr2-">Interpretation</td></tr><tr><td class="prov1Txt"><strong>2.</strong><a name="pr2-ps1-"></a><span class="prov2TxtIL">—(1)&nbsp; In this Act, unless the context otherwise requires&nbsp;—<table><tr><td class="def">“supplier” means a fixture person whose business —<table class="p1_1"><tr><td class="p1DefNo">(<em>a</em>)</td><td class="pDefTxt">provides fixture goods;</td></tr><tr><td class="p1DefNo">(<em>b</em>)</td><td class="pDefTxt">manufactures fixture goods;</td></tr></table><table><tr><td class="defSO">and includes the person’s fixture agent;</td></tr></table></td></tr></table><table><tr><td class="def">“contract” means a fixture agreement;</td></tr></table></span></td></tr><tr><td><div class="partNo">PART 2</div></td></tr><tr><td class="partHdr">OTHER PROVISIONS</td></tr><tr><td class="prov2Hdr" id="pr3-">Application</td></tr><tr><td class="prov2Txt" id="use">A supplier enters a contract.</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const body = document.getElementById('use') as HTMLElement;
    const defs = extractDefinitions(root);
    const supplier = definitionFor('supplier', body, root, defs);
    expect(supplier?.scope).toBe('act');
    expect(supplier?.text).toContain('provides fixture goods');
    expect(supplier?.text).toContain('manufactures fixture goods');
    expect(supplier?.text).toContain('fixture agent');
    expect(supplier?.text).not.toContain('fixture agreement');
    const original = root.textContent;
    const annotations = new Annotations(root, url);
    annotations.scan();
    const triggers = Array.from(body.querySelectorAll(`[${ANNOTATION_ATTR}]`));
    expect(triggers.map((el) => el.textContent)).toEqual(['supplier', 'contract']);
    expect(annotations.reference(triggers[0])?.text).toBe(supplier?.text);
    expect(root.querySelector(`.def [${ANNOTATION_ATTR}]`)).toBeNull();
    annotations.clear();
    expect(root.textContent).toBe(original);
  });
  it('does not take definition scope from clauses inside a preceding definition', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr2-">Interpretation</td></tr><tr><td class="prov1Txt">In this Act —<table><tr><td class="def">“agreement” includes a fixture agreement described by —<table><tr><td>the words “in this section” in a quotation;</td></tr></table></td></tr></table><table><tr><td class="def">“supplier” means a fixture person;</td></tr></table></td></tr><tr><td class="prov2Hdr" id="pr3-">Application</td></tr><tr><td id="use">supplier</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const defs = extractDefinitions(root);
    expect(
      definitionFor('supplier', document.getElementById('use') as Element, root, defs)?.scope
    ).toBe('act');
  });
  it('reads a later local introduction after an Act-wide definition in the same cell', () => {
    document.body.innerHTML =
      '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr2-">Interpretation</td></tr><tr><td class="prov1Txt"><span>In this Act —<table><tr><td class="def">“person” means a fixture individual;</td></tr></table>In this section —<table><tr><td class="def">“supplier” means a fixture person;</td></tr></table></span></td></tr><tr><td class="prov2Hdr" id="pr3-">Application</td></tr><tr><td id="outside">supplier and person</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    const defs = extractDefinitions(root);
    expect(defs.map(({ term, scope }) => ({ term, scope }))).toEqual([
      { term: 'person', scope: 'act' },
      { term: 'supplier', scope: 'section:2' },
    ]);
    const outside = document.getElementById('outside') as Element;
    expect(definitionFor('supplier', outside, root, defs)).toBeUndefined();
    expect(definitionFor('person', outside, root, defs)?.scope).toBe('act');
  });
  it('reads nested definitions inside a provision container with a separate legacy heading', () => {
    document.body.innerHTML =
      '<div id="legisContent"><div class="prov1" id="pr2-"><table><tr><td class="prov1Hdr" id="pr2-he-">Interpretation</td></tr><tr><td class="prov1Txt">In this Act —<table><tr><td class="def">“supplier” means a fixture person;</td></tr></table></td></tr></table></div><table><tr><td class="prov1Hdr" id="pr3-he-">Application</td></tr><tr><td id="use">supplier</td></tr></table></div>';
    const root = contentRoot(document) as HTMLElement;
    expect(
      definitionFor(
        'supplier',
        document.getElementById('use') as Element,
        root,
        extractDefinitions(root)
      )?.scope
    ).toBe('act');
  });
  it.each([
    ['pr6-', 'Circumstances surrounding unfair practice'],
    ['pr8-', 'Voluntary compliance agreement'],
    ['pr8-he-', 'Voluntary compliance agreement'],
  ])(
    'leaves ordinary SSO headings unannotated while preserving references to them (%s)',
    (id, title) => {
      document.body.innerHTML = `<div id="legisContent"><table><tr><td class="prov1Hdr" id="${id}"><span class="noBold"></span><span>${title}</span></td></tr><tr><td class="prov1Txt" id="reference">See section ${id === 'pr6-' ? '6' : '8'}.</td></tr></table></div>`;
      const root = contentRoot(document) as HTMLElement;
      const original = root.textContent;
      const annotations = new Annotations(root, url);
      annotations.scan();
      expect(document.getElementById(id)?.querySelector(`[${ANNOTATION_ATTR}]`)).toBeNull();
      const trigger = root.querySelector(`#reference [${ANNOTATION_ATTR}]`) as Element;
      expect(annotations.reference(trigger)?.kind).toBe('local');
      expect(annotations.reference(trigger)?.target).toBe(document.getElementById(id));
      annotations.clear();
      expect(root.textContent).toBe(original);
    }
  );
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
it('keeps explicit alias editions without marking ordinary words as definitions', () => {
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
  expect(refs.some((r) => r.reference.kind === 'definition')).toBe(false);
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
it('retains the case name and paragraph range next to an SLR citation', () => {
  document.body.innerHTML =
    '<div id="divJudgement"><p id="p">See <i>L W Infrastructure Pte Ltd v Lim Chin San Contractors Pte Ltd</i> [2014] 1 SLR 1221 (“L W Infrastructure”) at [28]–[29].</p></div>';
  const root = contentRoot(document) as HTMLElement;
  const p = document.getElementById('p') as HTMLElement;
  const refs = detectReferences(
    p.textContent ?? '',
    p,
    root,
    'https://www.elitigation.sg/gd/s/2024_SGCA_12'
  );
  expect(refs[0]?.reference).toMatchObject({
    kind: 'case',
    caseName: 'L W Infrastructure Pte Ltd v Lim Chin San Contractors Pte Ltd',
    paragraphs: ['28', '29'],
  });
});
it('does not add a guessed court definition after an Act citation', () => {
  document.body.innerHTML =
    '<div id="divJudgement"><p>Arbitration Act 2001 (2020 Rev Ed) (the “AA”)</p><p id="p">Under s 21 of the AA, the court allowed the application.</p></div>';
  const root = contentRoot(document) as HTMLElement;
  const p = document.getElementById('p') as HTMLElement;
  expect(detectReferences(p.textContent ?? '', p, root, url).map((r) => r.reference.kind)).toEqual([
    'statute',
  ]);
});
it('captures an adjacent quoted statutory provision as a literal preview', () => {
  document.body.innerHTML =
    '<div id="divJudgement"><div class="Judg-1">52 Under s 44 of the Arbitration Act 2001, the provision reads:</div><div class="Judg-Quote-0">Effect of award</div><div class="Judg-Quote-0">44.—(2) The tribunal must not vary the award.</div><div class="Judg-1">53 The next paragraph.</div></div>';
  const root = contentRoot(document) as HTMLElement;
  const p = root.querySelector('.Judg-1') as HTMLElement;
  const ref = detectReferences(p.textContent ?? '', p, root, url)[0]?.reference;
  expect(ref?.quote).toBe('Effect of award\n44.—(2) The tribunal must not vary the award.');
});
it('reads legacy public judgment headers and paragraph anchors', () => {
  const doc = parseHtml(
    '<div id="divJudgement"><h2><span class="caseTitle">Example Ltd <em>v</em> Other Ltd</span><span class="Citation">[2013] SGHC 264</span></h2><table id="info-table"><tr><td class="txt-label">Decision Date</td><td class="txt-body">29 November 2013</td></tr><tr><td class="txt-label">Tribunal/Court</td><td class="txt-body">High Court</td></tr></table><p class="Judg-Date">Judgment reserved.</p><p class="Judg-1"><a id="p1_28"></a>28&nbsp;&nbsp;Exact paragraph text.</p></div>'
  );
  const summary = pageSummary(doc, 'https://www.elitigation.sg/gd/s/2013_SGHC_264');
  expect(summary).toMatchObject({
    title: 'Example Ltd v Other Ltd',
    citation: '[2013] SGHC 264',
    court: 'High Court',
    date: '29 November 2013',
  });
});
