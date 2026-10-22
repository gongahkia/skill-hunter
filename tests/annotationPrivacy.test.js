const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const annotations = require('../judgeman_v4/src/annotations.js');
const { createContentApp } = require('../judgeman_v4/src/contentApp.js');
const extractorApi = require('../judgeman_v4/src/extractor.js');

test('missing extension storage cannot leak a note to host-page storage', async () => {
  const values = {};
  Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{
    getItem:key=>values[key] ?? null, setItem:(key,value)=>{values[key]=value;},
  }});
  try {
    await assert.rejects(async () => annotations.add('SYNTHETIC/PRIVATE', 'SYNTHETIC PRIVATE NOTE'));
    assert.deepEqual(values, {});
  } finally { delete globalThis.localStorage; }
});

test('the host document cannot directly read the annotation editor or rendered notes', async () => {
  const html = fs.readFileSync(path.join(__dirname,'fixtures/elit-preservation.html'),'utf8');
  const dom = new JSDOM(html,{url:'https://www.elitigation.sg/gd/s/2026_SGHC_9999'});
  const app = createContentApp({window:dom.window,document:dom.window.document,
    browserApi:{runtime:{onMessage:{addListener(){}}}},extractorApi});
  app.start();await app.showReadableView();
  assert.equal(dom.window.document.querySelector('.jm-annotations, #judgeman-reader-root'),null);
  const host=dom.window.document.getElementById('judgeman-reader-host');
  assert(host);assert.equal(host.shadowRoot,null);
});
