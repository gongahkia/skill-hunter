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
    listChats: async () => [],
    listExtractionRuns: async () => []
  };
  const vaultQuota = {
    getQuotaUsage: async () => quota
  };
  const code = [
    'var api = this._api;',
    'var browser = undefined;',
    'var chrome = undefined;',
    'var module = undefined;',
    'var URL = this._url || window.URL;',
    'var VaultDAO = this._vaultDAO;',
    'var VaultQuota = this._vaultQuota;',
    'var ExportHistory = { getAll: async function() { return []; }, clear: async function() {} };',
    'var AppLogger = { getRecent: async function() { return []; }, clear: async function() {}, serializeError: function(error) { return { message: error && error.message ? error.message : String(error) }; }, info: function() {}, warn: function() {}, error: function() {} };',
    loadSrc('storage.js'),
    loadSrc('converters.js'),
    loadSrc('filename.js'),
    loadSrc('ui/colorschemes.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('options/chat-list.js'),
    loadSrc('options.js')
  ].join('\n');
  const fn = new Function('window', 'document', code);
  const captured = { blob: null, url: null, revoked: [] };
  const objectURL = {
    createObjectURL(blob) {
      captured.blob = blob;
      captured.url = 'blob:bulk-export';
      return captured.url;
    },
    revokeObjectURL(url) {
      captured.revoked.push(url);
    }
  };
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function(tagName) {
    const element = originalCreateElement(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      element.click = function() {
        captured.download = element.download;
        captured.href = element.href;
      };
    }
    return element;
  };
  fn.call({ _api: makeApi(onChanged, storage), _vaultDAO: Object.assign(defaultVaultDAO, vaultDAO || {}), _vaultQuota: vaultQuota, _url: objectURL }, dom.window, dom.window.document);
  await flush();
  dom._downloads = captured;
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

  it('renders recent extraction runs in the debug pane', async () => {
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 1,
        totalMessages: 2,
        oldestChat: { title: 'Eval chat' },
        newestChat: { title: 'Eval chat' },
        perPlatform: [{ platform: 'chatgpt', chats: 1, messages: 2 }]
      }],
      quota: { usageMB: 1 },
      onChanged: {},
      vaultDAO: {
        listExtractionRuns: async () => [
          {
            runId: 'run-1',
            chatId: 'chat-1',
            modelName: 'Qwen/Qwen2.5-0.5B-Instruct',
            modelVersion: 'q4',
            completedAt: '2026-06-16T01:02:03.000Z',
            threadCount: 3,
            durationMs: 42
          }
        ]
      }
    });

    const text = dom.window.document.getElementById('extraction-runs-list').textContent;
    expect(text).toContain('Qwen/Qwen2.5-0.5B-Instruct');
    expect(text).toContain('q4');
    expect(text).toContain('chat-1 | 3 threads | 42ms');
  });

  it('exports 5 selected chats to one Markdown file', async () => {
    const chats = Array.from({ length: 5 }, (_, index) => ({
      chatId: `chat-${index}`,
      platform: index % 2 ? 'claude' : 'chatgpt',
      title: `Chat ${index}`,
      model: 'test-model',
      lastUpdatedAt: '2026-06-16T00:00:00.000Z',
      messageCount: 1
    }));
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 5,
        totalMessages: 5,
        oldestChat: chats[0],
        newestChat: chats[4],
        perPlatform: [{ platform: 'chatgpt', chats: 3, messages: 3 }]
      }],
      quota: { usageMB: 1 },
      onChanged: {},
      vaultDAO: {
        listChats: async () => chats,
        listMessages: async (chatId) => [
          { messageId: `${chatId}-msg-1`, role: 'user', content: `Question from ${chatId}`, timestamp: '2026-06-16T00:00:00.000Z', index: 0 }
        ],
        listOpenThreads: async () => []
      }
    });

    const doc = dom.window.document;
    const checks = doc.querySelectorAll('.chat-select');
    expect(checks).toHaveLength(5);
    chats.forEach((chat) => {
      doc.querySelector(`[data-chat-id="${chat.chatId}"] .chat-select`).click();
    });
    expect(doc.getElementById('bulkExportSummary').textContent).toBe('5 selected');

    doc.getElementById('bulkExportFormat').value = 'markdown';
    doc.getElementById('bulkExportSelected').click();
    await flush();

    expect(dom._downloads.download).toMatch(/rakuzaichi_bulk_\d{4}-\d{2}-\d{2}\.md$/);
    expect(dom._downloads.blob.type).toBe('text/markdown;charset=utf-8');
    const markdown = await dom._downloads.blob.text();
    expect(markdown.match(/^# Chat /gm)).toHaveLength(5);
    expect(markdown).toContain('Question from chat-4');
    expect((markdown.match(/\n---\n/g) || [])).toHaveLength(4);
    expect(doc.getElementById('bulkExportSummary').textContent).toBe('0 selected');
  });
});
