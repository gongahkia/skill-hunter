import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadSrc(filename) {
  return readFileSync(resolve(__dirname, '..', 'src', filename), 'utf8');
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
  code += 'this.exports = { DomUtils: typeof DomUtils !== "undefined" ? DomUtils : undefined, MessageSchema: typeof MessageSchema !== "undefined" ? MessageSchema : undefined, FormatConverter: typeof FormatConverter !== "undefined" ? FormatConverter : undefined, FilenameBuilder: typeof FilenameBuilder !== "undefined" ? FilenameBuilder : undefined, StorageManager: typeof StorageManager !== "undefined" ? StorageManager : undefined, PlatformRegistry: typeof PlatformRegistry !== "undefined" ? PlatformRegistry : undefined };';
  const fn = new Function(code);
  const obj = { _api: apiStub, exports: {} };
  fn.call(obj);
  return obj.exports;
}
