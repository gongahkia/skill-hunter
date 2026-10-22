const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const extractor = require('../judgeman_v4/src/extractor.js');
const { createContentApp } = require('../judgeman_v4/src/contentApp.js');
const html = fs.readFileSync(path.join(__dirname, 'fixtures/elit-preservation.html'), 'utf8');
function setup() {
  return new JSDOM(html, {pretendToBeVisual:true, url:'https://www.elitigation.sg/gd/s/2026_SGHC_9999'});
}

test('repeated headings retain both sections, unnumbered continuations and nested body text once', () => {
  const dom=setup();
  const data=extractor.extractCaseData(dom.window.document);
  const paragraphs=Object.values(data.caseBody).flat();
  assert(paragraphs.some(p=>p.includes('First reasons survive.')));
  assert(paragraphs.some(p=>p.includes('Second reasons survive,')));
  assert(paragraphs.some(p=>p==='This is an unnumbered continuation with café and 中文 ⚖️.'));
  assert.equal(paragraphs.filter(p=>p.includes('nested formatting class')).length,1);
});

test('superscripts, lower headings, tables, links and footnote text survive in the readable view', async () => {
  const dom=setup();
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start(); await app.showReadableView();
  const reader=app.getReaderRoot();
  const sections=reader.querySelectorAll('.jm-section');
  assert.equal(Array.from(sections,s=>s.querySelector('summary').textContent).filter(t=>t==='Reasons').length,2);
  const judgmentText=Array.from(reader.querySelectorAll('.jm-section-body'),n=>n.textContent).join(' ');
  assert.match(judgmentText,/10 This paragraph keeps its original label/);
  assert.match(judgmentText,/10A The area is x2/);
  assert.match(judgmentText,/20 Second reasons survive/);
  assert.match(reader.textContent,/Scope of the reasons/);
  assert.match(reader.textContent,/Synthetic record at page 42/);
  assert.equal(reader.querySelector('sup')?.textContent,'2');
  assert.equal(reader.querySelectorAll('table caption').length,1);
  assert.equal(reader.querySelector('a[href="https://example.org/authority?q=1&x=2"]')?.textContent,'the original authority');
  assert(reader.querySelector('[id="jm-source-p15"]'));
  assert(reader.querySelector('a[href="#jm-source-p15"]'));
  assert(reader.querySelector('[id="jm-source-heading-start"]'));
});

test('active elements cannot evade sanitization by carrying a body class on the root', async () => {
  const dom=setup();
  const unsafe=dom.window.document.createElement('iframe');
  unsafe.className='Judg-1';unsafe.src='https://example.org/unsafe';
  unsafe.textContent='Fallback source text';
  dom.window.document.querySelector('#divJudgement').appendChild(unsafe);
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start();await app.showReadableView();
  assert.equal(app.getReaderRoot().querySelector('iframe'),null);
  assert.match(app.getReaderRoot().textContent,/Fallback source text/);
});

test('prototype-shaped and repeated headings cannot discard source paragraphs', () => {
  const dom=setup();
  const headings=dom.window.document.querySelectorAll('.Judg-Heading-1');
  headings[1].textContent='__proto__';headings[2].textContent='__proto__';
  const data=extractor.extractCaseData(dom.window.document);
  assert.equal(data.caseSections.filter(s=>s.title==='__proto__').length,2);
  assert(Object.values(data.caseBody).flat().some(p=>p.startsWith('15 First')));
  assert(Object.values(data.caseBody).flat().some(p=>p.startsWith('20 Second')));
});

test('heading Unicode whitespace is preserved exactly as supplied by ELIT', async () => {
  const dom=setup();
  const title='Issue 1: Mr\u00a0Example’s statement';
  dom.window.document.querySelector('.Judg-Heading-2').textContent=title;
  const data=extractor.extractCaseData(dom.window.document);
  assert.equal(data.caseSections[1].title,title);
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start();await app.showReadableView();
  const summaries=app.getReaderRoot().querySelectorAll('.jm-section > summary');
  assert.equal(summaries[1].textContent,title);
});

test('navigation to a repeated section reaches the second original heading', async () => {
  const dom=setup();let scrolled=null;
  dom.window.HTMLElement.prototype.scrollIntoView=function(){scrolled=this;};
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start();await app.showReadableView();
  const link=Array.from(app.getReaderRoot().querySelectorAll('.jm-overlay-link')).find(el=>el.textContent==='Reasons (2)');
  assert(link);link.click();
  assert(scrolled);
  assert.equal(scrolled.querySelector('summary').textContent,'Reasons');
  assert.match(scrolled.textContent,/20 Second reasons survive/);
});

test('unclassified tables and list wrappers retain every cell and limb in source order', async () => {
  const dom=setup();
  const table=dom.window.document.createElement('table');
  table.className='future-layout';
  table.innerHTML='<tbody><tr><td><p>Left original account</p></td><td><p class="Judg-Quote-0">Right revised account</p></td></tr></tbody>';
  dom.window.document.getElementById('p15').after(table);
  const wrapper=dom.window.document.createElement('div');
  wrapper.innerHTML='<p>(a) First limb has no known class.</p><p class="Judg-List-1">(b) Second limb follows.</p>';
  table.after(wrapper);
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start();await app.showReadableView();
  const rendered=app.getReaderRoot();
  const copied=Array.from(rendered.querySelectorAll('.jm-section-body table')).find(n=>n.textContent.includes('Left original'));
  assert(copied);assert.equal(copied.rows[0].cells.length,2);
  assert.equal(copied.textContent,'Left original accountRight revised account');
  const body=Array.from(rendered.querySelectorAll('.jm-section-body')).map(n=>n.textContent).join(' ');
  assert.match(body,/Left original accountRight revised account\(a\) First limb has no known class\.\(b\) Second limb follows\./);
});

test('source text that looks like active HTML remains literal and source handlers are excluded', async () => {
  const dom=setup();
  dom.window.document.querySelector('#p10').textContent='10 <img src=x onerror=alert(1)> is literal.';
  dom.window.document.querySelector('#p20').innerHTML='20 <a href="javascript:alert(1)" onclick="alert(2)">Unsafe link label</a>';
  const app=createContentApp({window:dom.window,document:dom.window.document,
    extractorApi:extractor,browserApi:{runtime:{onMessage:{addListener(){}}}}});
  app.start();await app.showReadableView();
  const reader=app.getReaderRoot();
  assert.equal(reader.querySelector('img,script,[onclick],[onerror],a[href^="javascript:"]'),null);
  assert.match(reader.textContent,/<img src=x onerror=alert\(1\)> is literal/);
});
