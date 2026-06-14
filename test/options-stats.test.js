import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeApi(onChanged, storage) {
  return {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...storage };
        },
        async set(payload) {
          Object.assign(storage, payload);
        }
      },
      onChanged: {
        addListener(listener) {
          onChanged.listener = listener;
        }
      }
    }
  };
}

async function loadOptions({ statsQueue, quota, onChanged, vaultDAO }) {
  const storage = {};
  const dom = new JSDOM(loadSrc('options.html'), { url: 'https://extension.test/options.html', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });
  const defaultVaultDAO = {
    getStats: async () => statsQueue.shift() || statsQueue[0],
    listChats: async () => []
  };
  const vaultQuota = {
    getQuotaUsage: async () => quota
  };
  const code = [
    'var api = this._api;',
    'var browser = undefined;',
    'var chrome = undefined;',
    'var module = undefined;',
    'var VaultDAO = this._vaultDAO;',
    'var VaultQuota = this._vaultQuota;',
    'var ExportHistory = { getAll: async function() { return []; }, clear: async function() {} };',
    'var AppLogger = { getRecent: async function() { return []; }, clear: async function() {}, serializeError: function(error) { return { message: error && error.message ? error.message : String(error) }; }, info: function() {}, warn: function() {}, error: function() {} };',
    loadSrc('storage.js'),
    loadSrc('ui/colorschemes.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('options.js')
  ].join('\n');
  const fn = new Function('window', 'document', code);
  fn.call({ _api: makeApi(onChanged, storage), _vaultDAO: Object.assign(defaultVaultDAO, vaultDAO || {}), _vaultQuota: vaultQuota }, dom.window, dom.window.document);
  await flush();
  return dom;
}

describe('options vault stats', () => {
  it('renders vault stats and refreshes after capture status changes', async () => {
    const onChanged = {};
    const statsQueue = [
      {
        totalChats: 2,
        totalMessages: 7,
        oldestChat: { title: 'First chat' },
        newestChat: { title: 'Latest chat' },
        perPlatform: [{ platform: 'claude', chats: 2, messages: 7 }]
      },
      {
        totalChats: 3,
        totalMessages: 12,
        oldestChat: { title: 'First chat' },
        newestChat: { title: 'Captured now' },
        perPlatform: [
          { platform: 'claude', chats: 2, messages: 7 },
          { platform: 'chatgpt', chats: 1, messages: 5 }
        ]
      }
    ];
    const dom = await loadOptions({ statsQueue, quota: { usageMB: 12.34 }, onChanged });

    expect(dom.window.document.getElementById('statsTotalChats').textContent).toBe('2');
    expect(dom.window.document.getElementById('statsTotalMessages').textContent).toBe('7');
    expect(dom.window.document.getElementById('statsStorageUsed').textContent).toBe('12.34 MB');
    expect(dom.window.document.getElementById('statsOldestChat').textContent).toBe('First chat');
    expect(dom.window.document.getElementById('statsNewestChat').textContent).toBe('Latest chat');
    expect(dom.window.document.getElementById('statsPlatformBreakdown').textContent).toBe('claude: 2 chats, 7 messages');

    onChanged.listener({
      lastCaptureStatus: {
        newValue: {
          state: 'success',
          message: 'Captured 5 messages.',
          timestamp: new Date().toISOString()
        }
      }
    }, 'local');
    await flush();

    expect(dom.window.document.getElementById('statsTotalChats').textContent).toBe('3');
    expect(dom.window.document.getElementById('statsTotalMessages').textContent).toBe('12');
    expect(dom.window.document.getElementById('statsNewestChat').textContent).toBe('Captured now');
    expect(dom.window.document.getElementById('capture-status-text').textContent).toBe('Captured 5 messages.');
  });

  it('rescans all messages without duplicating existing thread keys', async () => {
    const onChanged = {};
    const written = [];
    const existing = [
      { threadId: 'existing-1', chatId: 'chat-1', messageId: 'msg-1', tag: 'TODO', text: 'ping Alice', source: 'explicit', subSource: 'scan', status: 'open' }
    ];
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 1,
        totalMessages: 1,
        oldestChat: { title: 'Tagged chat' },
        newestChat: { title: 'Tagged chat' },
        perPlatform: [{ platform: 'chatgpt', chats: 1, messages: 1 }]
      }],
      quota: { usageMB: 1 },
      onChanged,
      vaultDAO: {
        listAllMessages: async () => [
          { chatId: 'chat-1', messageId: 'msg-1', content: 'TODO: ping Alice\nREF: source doc', timestamp: '2026-01-01T00:00:00.000Z' }
        ],
        listOpenThreads: async () => existing.slice(),
        putOpenThreads: async (rows) => {
          written.push(...rows);
          existing.push(...rows);
          return rows;
        }
      }
    });

    dom.window.document.getElementById('rescanThreads').click();
    await flush();
    expect(written.map((row) => row.tag)).toEqual(['REF']);
    expect(dom.window.document.getElementById('rescanStatus').textContent).toBe('Added 1 threads');

    dom.window.document.getElementById('rescanThreads').click();
    await flush();
    expect(written).toHaveLength(1);
    expect(dom.window.document.getElementById('rescanStatus').textContent).toBe('Added 0 threads');
  });
});
