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

async function loadOptions({ statsQueue, quota, onChanged, vaultDAO, showDirectoryPicker }) {
  const storage = {};
  const dom = new JSDOM(loadSrc('options.html'), { url: 'https://extension.test/options.html', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });
  if (showDirectoryPicker) dom.window.showDirectoryPicker = showDirectoryPicker;
  const defaultVaultDAO = {
    getStats: async () => statsQueue.shift() || statsQueue[0],
    listChats: async () => [],
    listOpenThreads: async () => [],
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
    loadSrc('zip.js'),
    loadSrc('backup.js'),
    loadSrc('obsidian-sync.js'),
    loadSrc('ui/colorschemes.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('options/wrapped-stats.js'),
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

function makeDirectoryHandle(name, permission = 'granted') {
  const handle = {
    name,
    permission,
    directories: {},
    files: {},
    async queryPermission() {
      return handle.permission;
    },
    async requestPermission() {
      handle.permission = 'granted';
      return handle.permission;
    },
    async getDirectoryHandle(childName, options) {
      if (!handle.directories[childName]) {
        if (!options || !options.create) throw new Error('directory not found');
        handle.directories[childName] = makeDirectoryHandle(childName, handle.permission);
      }
      return handle.directories[childName];
    },
    async getFileHandle(fileName, options) {
      if (!handle.files[fileName]) {
        if (!options || !options.create) throw new Error('file not found');
        const file = { content: '' };
        handle.files[fileName] = {
          file,
          async createWritable() {
            return {
              async write(content) {
                file.content = content;
              },
              async close() {}
            };
          }
        };
      }
      return handle.files[fileName];
    }
  };
  return handle;
}

async function readStoredEntries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries[name] = decoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
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

  it('renders wrapped stats and downloads a shareable PNG', async () => {
    const chats = [
      {
        chatId: 'chat-1',
        platform: 'chatgpt',
        title: 'Typescript refactor TODO',
        messageCount: 12,
        tags: ['typescript'],
        lastUpdatedAt: '2026-06-15T10:00:00.000Z'
      },
      {
        chatId: 'chat-2',
        platform: 'claude',
        title: 'Launch plan',
        messageCount: 31,
        tags: ['launch'],
        lastUpdatedAt: '2026-06-16T12:00:00.000Z'
      },
      {
        chatId: 'chat-3',
        platform: 'claude',
        title: 'Long Work Plan',
        messageCount: 44,
        tags: ['launch'],
        lastUpdatedAt: '2026-06-16T13:00:00.000Z'
      }
    ];
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 3,
        totalMessages: 87,
        oldestChat: chats[0],
        newestChat: chats[2],
        perPlatform: [{ platform: 'claude', chats: 2, messages: 75 }]
      }],
      quota: { usageMB: 2 },
      onChanged: {},
      vaultDAO: {
        listChats: async () => chats,
        listOpenThreads: async () => [
          { threadId: 't1', tag: 'TODO', text: 'ship launch notes', status: 'open' },
          { threadId: 't2', tag: 'REF', text: 'typescript references', status: 'open' }
        ]
      }
    });
    const doc = dom.window.document;
    expect(doc.getElementById('wrappedMostActivePlatform').textContent).toBe('Claude');
    expect(doc.getElementById('wrappedBusiestDay').textContent).toContain('2026');
    expect(doc.getElementById('wrappedLongestChat').textContent).toBe('Long Work Plan');
    expect(doc.getElementById('wrappedTopTopics').textContent).toContain('launch');
    expect(doc.getElementById('wrappedRenderTime').textContent).toMatch(/Rendered in \d+ms from 3 chats\./);

    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
      fillStyle: '',
      font: '',
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      closePath() {},
      fill() {},
      fillRect() {},
      fillText() {}
    });
    dom.window.HTMLCanvasElement.prototype.toBlob = function(callback, type) {
      callback(new dom.window.Blob(['png'], { type }));
    };
    doc.getElementById('wrappedSharePng').click();
    await flush();

    expect(dom._downloads.download).toMatch(/^rakuzaichi_wrapped_\d{4}-\d{2}-\d{2}\.png$/);
    expect(dom._downloads.blob.type).toBe('image/png');
    expect(doc.getElementById('wrappedStatus').textContent).toBe('PNG saved.');
  });

  it('summarizes a 1000-chat wrapped data set under 500ms', async () => {
    const module = { exports: {} };
    const fn = new Function('module', 'exports', loadSrc('options/wrapped-stats.js'));
    fn(module, module.exports);
    const wrapped = module.exports;
    const chats = Array.from({ length: 1000 }, (_, index) => ({
      chatId: `chat-${index}`,
      platform: index % 3 === 0 ? 'claude' : index % 3 === 1 ? 'chatgpt' : 'gemini',
      title: `Topic ${index % 20} planning thread`,
      messageCount: 1 + (index % 60),
      tags: [`topic-${index % 10}`],
      lastUpdatedAt: `2026-06-${String(1 + (index % 28)).padStart(2, '0')}T12:00:00.000Z`
    }));
    const threads = Array.from({ length: 300 }, (_, index) => ({
      threadId: `thread-${index}`,
      tag: index % 2 ? 'TODO' : 'REF',
      text: `topic ${index % 12}`,
      status: 'open'
    }));

    const start = performance.now();
    const summary = wrapped.summarize(chats, threads);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(summary.totalChats).toBe(1000);
    expect(summary.longestChat.messageCount).toBe(60);
    expect(summary.topTopics.length).toBeGreaterThan(0);
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

  it('picks an Obsidian vault and syncs Markdown notes from the options UI', async () => {
    const root = makeDirectoryHandle('Obsidian');
    const meta = {};
    const chat = { chatId: 'chatgpt:sync-1', platform: 'chatgpt', title: 'Sync Me', model: 'gpt-4', messageCount: 1 };
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 1,
        totalMessages: 1,
        oldestChat: chat,
        newestChat: chat,
        perPlatform: [{ platform: 'chatgpt', chats: 1, messages: 1 }]
      }],
      quota: { usageMB: 1 },
      onChanged: {},
      showDirectoryPicker: async () => root,
      vaultDAO: {
        getMeta: async (key) => meta[key] || null,
        setMeta: async (key, value) => {
          meta[key] = value;
          return value;
        },
        listChats: async () => [chat],
        listMessages: async () => [
          { messageId: 'm1', role: 'user', content: 'Write this note', index: 0 }
        ],
        listOpenThreads: async () => []
      }
    });

    const doc = dom.window.document;
    expect(doc.getElementById('obsidianSyncStatus').textContent).toBe('No Obsidian vault selected.');

    doc.getElementById('chooseObsidianVault').click();
    await flush();
    expect(doc.getElementById('obsidianSyncStatus').textContent).toBe('Vault selected: Obsidian');
    expect(doc.getElementById('syncObsidianVault').disabled).toBe(false);

    doc.getElementById('syncObsidianVault').click();
    await flush();
    const folder = root.directories.Rakuzaichi;
    const fileName = Object.keys(folder.files)[0];

    expect(doc.getElementById('obsidianSyncStatus').textContent).toBe('Synced 1 chat to Rakuzaichi.');
    expect(fileName).toMatch(/^chatgpt_Sync_Me_sync-1.*\.md$/);
    expect(folder.files[fileName].file.content).toContain('# Sync Me');
    expect(folder.files[fileName].file.content).toContain('Write this note');
  });

  it('downloads an Obsidian ZIP fallback when direct sync is unavailable', async () => {
    const chat = { chatId: 'claude:fallback-1', platform: 'claude', title: 'Fallback Sync', model: 'claude', messageCount: 1 };
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 1,
        totalMessages: 1,
        oldestChat: chat,
        newestChat: chat,
        perPlatform: [{ platform: 'claude', chats: 1, messages: 1 }]
      }],
      quota: { usageMB: 1 },
      onChanged: {},
      vaultDAO: {
        listChats: async () => [chat],
        listMessages: async () => [
          { messageId: 'm1', role: 'assistant', content: 'Fallback note', index: 0 }
        ],
        listOpenThreads: async () => []
      }
    });

    const doc = dom.window.document;
    expect(doc.getElementById('chooseObsidianVault').hidden).toBe(true);
    expect(doc.getElementById('obsidianFallbackNote').hidden).toBe(false);
    expect(doc.getElementById('obsidianFallbackNote').textContent).toContain('Direct sync unavailable');
    expect(doc.getElementById('syncObsidianVault').textContent).toBe('Download ZIP');
    expect(doc.getElementById('syncObsidianVault').disabled).toBe(false);

    doc.getElementById('syncObsidianVault').click();
    await flush();
    const entries = await readStoredEntries(dom._downloads.blob);
    const name = Object.keys(entries)[0];

    expect(dom._downloads.download).toMatch(/^rakuzaichi_obsidian_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(dom._downloads.blob.type).toBe('application/zip');
    expect(name).toMatch(/^Rakuzaichi\/claude_Fallback_Sync_fallback-1.*\.md$/);
    expect(entries[name]).toContain('Fallback note');
    expect(doc.getElementById('obsidianSyncStatus').textContent).toBe('Downloaded ZIP with 1 chat.');
  });

  it('exports an encrypted vault backup from the options UI', async () => {
    const chat = { chatId: 'chat-1', platform: 'chatgpt', title: 'Backup UI', messageCount: 1, tags: ['TODO'] };
    const dom = await loadOptions({
      statsQueue: [{
        totalChats: 1,
        totalMessages: 1,
        oldestChat: chat,
        newestChat: chat,
        perPlatform: [{ platform: 'chatgpt', chats: 1, messages: 1 }]
      }],
      quota: { usageMB: 1 },
      onChanged: {},
      vaultDAO: {
        listChats: async () => [chat],
        listAllMessages: async () => [{ messageId: 'msg-1', chatId: 'chat-1', role: 'user', content: 'Backup me', index: 0 }],
        listOpenThreads: async () => [],
        listFolders: async () => [],
        listExtractionRuns: async () => []
      }
    });

    const doc = dom.window.document;
    doc.getElementById('backupPassword').value = 'secret';
    doc.getElementById('exportBackup').click();
    for (let i = 0; i < 80 && !dom._downloads.blob; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(dom._downloads.blob).toBeTruthy();
    const entries = await readStoredEntries(dom._downloads.blob);
    const manifest = JSON.parse(entries['manifest.json']);

    expect(dom._downloads.download).toMatch(/\.rakuzaichi-backup\.zip$/);
    expect(manifest.encrypted).toBe(true);
    expect(manifest.payload).toBe('vault.json.aesgcm');
    expect(doc.getElementById('backupStatus').textContent).toContain('Exported');
  });
});
