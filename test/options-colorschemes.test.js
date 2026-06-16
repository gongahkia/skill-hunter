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

async function loadOptions(storage, options = {}) {
  const dom = new JSDOM(loadSrc('options.html'), { url: 'https://extension.test/options.html', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });
  if (options.promptApiStatus) {
    dom.window.LanguageModel = {
      availability: async () => options.promptApiStatus,
      create: async () => ({ prompt: async () => '[]', destroy() {} })
    };
  }

  const code = [
    'var api = this._api;',
    'var browser = undefined;',
    'var chrome = undefined;',
    'var module = undefined;',
    'var ExportHistory = { getAll: async function() { return []; }, clear: async function() {} };',
    'var AppLogger = { getRecent: async function() { return []; }, clear: async function() {}, serializeError: function(error) { return { message: error && error.message ? error.message : String(error) }; }, info: function() {}, warn: function() {}, error: function() {} };',
    loadSrc('storage.js'),
    loadSrc('ui/colorschemes.js'),
    options.includePromptApi ? loadSrc('extraction/prompt-api.js') : '',
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

  it('renders and persists the extraction model setting', async () => {
    const storage = { extractionModel: 'phi-3.5-mini-q4' };
    const dom = await loadOptions(storage);
    const select = dom.window.document.getElementById('extractionModel');

    expect([...select.options].map((option) => option.value)).toEqual(['qwen2.5-0.5b-q4', 'phi-3.5-mini-q4', 'gemma-3-1b-q4']);
    expect(select.value).toBe('phi-3.5-mini-q4');

    select.value = 'gemma-3-1b-q4';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(storage.extractionModel).toBe('gemma-3-1b-q4');
  });

  it('offers the built-in Prompt API backend when available', async () => {
    const storage = { extractionModel: 'gemini-nano-builtin' };
    const dom = await loadOptions(storage, { includePromptApi: true, promptApiStatus: 'available' });
    const select = dom.window.document.getElementById('extractionModel');
    const builtin = [...select.options].find((option) => option.value === 'gemini-nano-builtin');

    expect(builtin).toBeTruthy();
    expect(builtin.disabled).toBe(false);
    expect(select.value).toBe('gemini-nano-builtin');
    expect(dom.window.document.getElementById('extractionBackendStatus').textContent).toContain('available');

    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(storage.extractionModel).toBe('gemini-nano-builtin');
  });

  it('disables the built-in Prompt API backend when unavailable', async () => {
    const dom = await loadOptions({}, { includePromptApi: true, promptApiStatus: 'unavailable' });
    const select = dom.window.document.getElementById('extractionModel');
    const builtin = [...select.options].find((option) => option.value === 'gemini-nano-builtin');

    expect(builtin).toBeTruthy();
    expect(builtin.disabled).toBe(true);
    expect(select.value).toBe('qwen2.5-0.5b-q4');
    expect(dom.window.document.getElementById('extractionBackendStatus').textContent).toContain('unavailable');
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

  it('exposes tag colors for inline message highlighting', async () => {
    const dom = await loadOptions({ colorscheme: 'tokyo-night', darkMode: 'dark' });
    const style = dom.window.document.documentElement.style;

    expect(style.getPropertyValue('--tag-todo')).toBe('#e0af68');
    expect(style.getPropertyValue('--tag-ref')).toBe('#7aa2f7');
    expect(style.getPropertyValue('--tag-followup')).toBe('#bb9af7');
    expect(style.getPropertyValue('--tag-unresolved')).toBe('#f7768e');
    expect(style.getPropertyValue('--tag-prompt')).toBe('#9ece6a');
  });

  it('renders, reorders, and saves tag priority settings', async () => {
    const storage = {
      threadTagPriority: ['PROMPT', 'REF', 'FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV']
    };
    const dom = await loadOptions(storage);
    const rows = () => [...dom.window.document.querySelectorAll('#tagPriorityList [data-tag]')].map((row) => row.dataset.tag);

    expect(rows()).toEqual(['PROMPT', 'REF', 'FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV']);
    dom.window.document.querySelector('#tagPriorityList [data-tag="PROMPT"] button[aria-label="Move PROMPT down"]').click();
    expect(rows()).toEqual(['REF', 'PROMPT', 'FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV']);

    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(storage.threadTagPriority).toEqual(['REF', 'PROMPT', 'FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV']);
  });

  it('registers, prioritizes, filters, and saves custom thread tags', async () => {
    const storage = {};
    const dom = await loadOptions(storage);
    dom.window.document.getElementById('customThreadTagName').value = 'waiting';
    dom.window.document.getElementById('customThreadTagColor').value = '#123456';
    dom.window.document.getElementById('customThreadTagAdd').click();

    const rows = () => [...dom.window.document.querySelectorAll('#tagPriorityList [data-tag]')].map((row) => row.dataset.tag);
    expect(dom.window.document.querySelector('#customThreadTagsList [data-tag="WAITING"]')).toBeTruthy();
    expect(rows()).toContain('WAITING');
    expect([...dom.window.document.querySelectorAll('#threadTagFilter option')].map((option) => option.value)).toContain('WAITING');

    dom.window.document.getElementById('options-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(storage.customThreadTags).toEqual([{ tag: 'WAITING', color: '#123456' }]);
    expect(storage.threadTagPriority).toContain('WAITING');
  });
});
