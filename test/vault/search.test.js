import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import { loadSrc } from '../helpers.js';

function loadSearchWorkerRuntime() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('vault/search-worker.js'));
  fn(module, module.exports);
  return module.exports.createVaultSearchWorkerRuntime;
}

function loadVaultSearch() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('vault/search.js'));
  fn(module, module.exports);
  return module.exports;
}

class RuntimeWorker {
  constructor(runtime) {
    this.runtime = runtime;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    this.runtime.handleMessage(message, (response) => {
      if (this.onmessage) this.onmessage({ data: response });
    });
  }

  terminate() {}
}

function chats() {
  return [
    {
      chatId: 'chat-1',
      platform: 'chatgpt',
      title: 'Vault restore',
      url: 'https://chatgpt.com/c/chat-1',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 2,
      tags: ['TODO']
    },
    {
      chatId: 'chat-2',
      platform: 'claude',
      title: 'Release plan',
      url: 'https://claude.ai/chat/chat-2',
      lastUpdatedAt: '2026-01-02T00:00:00.000Z',
      messageCount: 1,
      tags: []
    }
  ];
}

function messages() {
  return [
    { messageId: 'm1', chatId: 'chat-1', role: 'user', content: 'Need the snapshot restore command', index: 0 },
    { messageId: 'm2', chatId: 'chat-1', role: 'assistant', content: 'Use the vault backup', index: 1 },
    { messageId: 'm3', chatId: 'chat-2', role: 'user', content: 'Ship the browser search worker', index: 0 }
  ];
}

describe('VaultSearch', () => {
  it('builds searchable documents from chats and messages', () => {
    const VaultSearch = loadVaultSearch();
    const docs = VaultSearch.createDocuments(chats(), messages());

    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ id: 'chat-1', title: 'Vault restore', platform: 'chatgpt' });
    expect(docs[0].content).toContain('snapshot restore command');
    expect(docs[0].content).toContain('vault backup');
  });

  it('indexes and searches inside the worker runtime', async () => {
    const createRuntime = loadSearchWorkerRuntime();
    const runtime = createRuntime(MiniSearch);

    runtime.build(loadVaultSearch().createDocuments(chats(), messages()));
    const results = runtime.search('snapshot');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ chatId: 'chat-1', title: 'Vault restore' });
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('loads from DAO and maps worker results back to chat rows', async () => {
    const createRuntime = loadSearchWorkerRuntime();
    const VaultSearch = loadVaultSearch();
    const search = VaultSearch.create({
      worker: new RuntimeWorker(createRuntime(MiniSearch)),
      dao: {
        listChats: async () => chats(),
        listAllMessages: async () => messages()
      }
    });

    expect(await search.load()).toHaveLength(2);
    expect((await search.search('browser worker')).map((chat) => chat.chatId)).toEqual(['chat-2']);
    expect((await search.search('')).map((chat) => chat.chatId)).toEqual(['chat-1', 'chat-2']);
  });
});
