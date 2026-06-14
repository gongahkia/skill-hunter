import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function makeApi(storage) {
  return {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...storage };
        },
        async set(payload) {
          Object.assign(storage, payload);
        }
      }
    },
    tabs: {
      query: async () => [{ id: 1 }],
      sendMessage: async () => ({ data: { supported: false } })
    },
    runtime: {
      sendMessage: async () => ({}),
      openOptionsPage() {}
    }
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadOptions(storage) {
  const dom = new JSDOM(loadSrc('options.html'), { url: 'https://extension.test/options.html', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });

  const code = [
    'var api = this._api;',
    'var browser = undefined;',
    'var chrome = undefined;',
    'var module = undefined;',
    'var ExportHistory = { getAll: async function() { return []; }, clear: async function() {} };',
    'var AppLogger = { getRecent: async function() { return []; }, clear: async function() {}, serializeError: function(error) { return { message: error && error.message ? error.message : String(error) }; }, info: function() {}, warn: function() {}, error: function() {} };',
    loadSrc('storage.js'),
    loadSrc('ui/colorschemes.js'),
    loadSrc('options.js')
  ].join('\n');
  const fn = new Function('window', 'document', code);
  fn.call({ _api: makeApi(storage) }, dom.window, dom.window.document);
  await flush();
  return dom;
}

async function loadPopup(storage) {
  const dom = new JSDOM(loadSrc('popup.html'), { url: 'https://extension.test/popup.html', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });

  const code = [
    'var api = this._api;',
    'var browser = undefined;',
    'var chrome = undefined;',
    'var module = undefined;',
    'var AppLogger = { createTraceId: function(prefix) { return prefix + "-test"; }, getRecent: async function() { return []; }, clear: async function() {}, serializeError: function(error) { return { message: error && error.message ? error.message : String(error) }; }, info: function() {}, warn: function() {}, error: function() {} };',
    loadSrc('storage.js'),
    loadSrc('history.js'),
    loadSrc('ui/colorschemes.js'),
    loadSrc('popup.js')
  ].join('\n');
  const fn = new Function('window', 'document', code);
  fn.call({ _api: makeApi(storage) }, dom.window, dom.window.document);
  await flush();
  return dom;
}

describe('options colorscheme settings', () => {
  it('renders, applies, saves, and reloads the selected colorscheme', async () => {
    const storage = { colorscheme: 'tokyo-night', darkMode: 'dark' };
    const dom = await loadOptions(storage);
    const select = dom.window.document.getElementById('colorscheme');

    expect(select.options.length).toBe(10);
    expect(select.value).toBe('tokyo-night');
    expect(dom.window.document.documentElement.style.getPropertyValue('--bg')).toBe('#1a1b26');

    select.value = 'github';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(dom.window.document.documentElement.style.getPropertyValue('--bg')).not.toBe('#ffffff');
    expect(storage.colorscheme).toBe('tokyo-night');

    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(storage.colorscheme).toBe('github');

    const reloaded = await loadOptions(storage);
    expect(reloaded.window.document.getElementById('colorscheme').value).toBe('github');
    expect(reloaded.window.document.documentElement.style.getPropertyValue('--bg')).not.toBe('#ffffff');
  });

  it('applies the saved colorscheme in popup UI', async () => {
    const dom = await loadPopup({ colorscheme: 'rose-pine', darkMode: 'dark' });

    expect(dom.window.document.documentElement.dataset.colorscheme).toBe('rose-pine');
    expect(dom.window.document.documentElement.dataset.themeMode).toBe('dark');
    expect(dom.window.document.documentElement.style.getPropertyValue('--bg')).toBe('#191724');
    expect(dom.window.document.documentElement.style.getPropertyValue('--primary')).toBe('#31748f');
  });

  it('applies and persists theme mode independently of colorscheme', async () => {
    const storage = { colorscheme: 'tokyo-night', darkMode: 'dark' };
    const dom = await loadOptions(storage);
    const theme = dom.window.document.getElementById('darkMode');
    const darkBg = dom.window.document.documentElement.style.getPropertyValue('--bg');

    theme.value = 'light';
    theme.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(dom.window.document.documentElement.dataset.colorscheme).toBe('tokyo-night');
    expect(dom.window.document.documentElement.dataset.themeMode).toBe('light');
    expect(dom.window.document.documentElement.style.getPropertyValue('--bg')).not.toBe(darkBg);
    expect(storage.darkMode).toBe('dark');

    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(storage.darkMode).toBe('light');

    const reloaded = await loadOptions(storage);
    expect(reloaded.window.document.getElementById('darkMode').value).toBe('light');
    expect(reloaded.window.document.documentElement.dataset.themeMode).toBe('light');
    expect(reloaded.window.document.documentElement.style.getPropertyValue('--bg')).not.toBe(darkBg);
  });
});
