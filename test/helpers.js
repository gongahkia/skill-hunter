import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadSrc(filename) {
  return readFileSync(resolve(__dirname, '..', 'src', filename), 'utf8');
}

export function loadFixture(filename) {
  return readFileSync(resolve(__dirname, filename), 'utf8');
}

export function evalSrc(...files) {
  const ctx = {};
  const apiStub = {
    storage: {
      sync: { get: async (d) => d, set: async () => {} },
      local: { get: async (d) => d, set: async () => {} },
      onChanged: { addListener() {} }
    },
    runtime: { onMessage: { addListener() {} }, sendMessage() {} },
    downloads: { download: async () => {} },
    tabs: { query: async () => [], sendMessage: async () => ({}) },
    alarms: { create() {}, clear: async () => {}, onAlarm: { addListener() {} } }
  };
  let code = 'var api = this._api;\nvar module = undefined;\n';
  for (const f of files) code += loadSrc(f) + '\n';
  code += 'this.exports = { DomUtils: typeof DomUtils !== "undefined" ? DomUtils : undefined, MessageSchema: typeof MessageSchema !== "undefined" ? MessageSchema : undefined, FormatConverter: typeof FormatConverter !== "undefined" ? FormatConverter : undefined, FilenameBuilder: typeof FilenameBuilder !== "undefined" ? FilenameBuilder : undefined, StorageManager: typeof StorageManager !== "undefined" ? StorageManager : undefined, PlatformRegistry: typeof PlatformRegistry !== "undefined" ? PlatformRegistry : undefined, AppLogger: typeof AppLogger !== "undefined" ? AppLogger : undefined };';
  const fn = new Function(code);
  const obj = { _api: apiStub, exports: {} };
  fn.call(obj);
  return obj.exports;
}

export function runPlatformExtraction({ fixture, url, platformFiles }) {
  const html = loadFixture(fixture);
  const dom = new JSDOM(html, { url });
  if (!Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, 'innerText')) {
    Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent;
      }
    });
  }
  const apiStub = {
    storage: {
      local: { get: async (d) => d, set: async () => {} },
      onChanged: { addListener() {} }
    }
  };
  let code = 'var browser = undefined;\nvar chrome = undefined;\nvar api = this._api;\nvar module = undefined;\n';
  const files = ['dom-utils.js', 'schema.js'].concat(platformFiles).concat(['platforms/registry.js']);
  for (const f of files) code += loadSrc(f) + '\n';
  code += 'var detected = PlatformRegistry.detect(); this.result = { detectedId: detected ? detected.id : null, extracted: detected ? detected.extract() : null };';
  const fn = new Function('window', 'document', code);
  const obj = { _api: apiStub, result: null };
  fn.call(obj, dom.window, dom.window.document);
  return obj.result;
}
