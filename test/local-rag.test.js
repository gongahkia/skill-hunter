import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadLocalRAG() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('rag/local-rag.js'));
  fn(module, module.exports);
  return module.exports;
}

function chats() {
  return [
    {
      chatId: 'chat-restore',
      platform: 'chatgpt',
      title: 'Vault restore',
      url: 'https://chatgpt.com/c/restore',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 2
    },
    {
      chatId: 'chat-release',
      platform: 'claude',
      title: 'Release plan',
      url: 'https://claude.ai/chat/release',
      lastUpdatedAt: '2026-01-02T00:00:00.000Z',
      messageCount: 1
    }
  ];
}

function messages() {
  return [
    { messageId: 'm1', chatId: 'chat-restore', role: 'user', content: 'How do I restore from a local backup snapshot?', index: 0 },
    { messageId: 'm2', chatId: 'chat-restore', role: 'assistant', content: 'Use the latest encrypted vault backup and verify the package hash.', index: 1 },
    { messageId: 'm3', chatId: 'chat-release', role: 'user', content: 'Ship the browser search worker after manifest checks pass.', index: 0 }
  ];
}

function fakeEmbedder() {
  return {
    async embed(texts) {
      return texts.map((value) => {
        const lower = String(value).toLowerCase();
        return [
          lower.includes('backup') || lower.includes('restore') || lower.includes('snapshot') ? 1 : 0,
          lower.includes('browser') || lower.includes('worker') || lower.includes('manifest') ? 1 : 0,
          lower.includes('hash') || lower.includes('encrypted') ? 0.4 : 0
        ];
      });
    }
  };
}

describe('LocalRAG', () => {
  it('creates deterministic cited chunks from vault messages', () => {
    const LocalRAG = loadLocalRAG();
    const chunks = LocalRAG.createChunks(chats(), messages());

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({
      sourceKind: 'message',
      sourceId: 'chat-restore',
      chatId: 'chat-restore',
      messageId: 'm1',
      title: 'Vault restore',
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/restore'
    });
    expect(chunks[0].chunkId).toMatch(/^rag:message:chat-restore:m1:0:/);
    expect(chunks[0].excerpt).toContain('restore from a local backup snapshot');
  });

  it('searches semantically and returns source chunks without answers', async () => {
    const LocalRAG = loadLocalRAG();
    const rag = LocalRAG.create({
      dao: {
        listChats: async () => chats(),
        listAllMessages: async () => messages()
      },
      embedder: fakeEmbedder()
    });

    const results = await rag.search('encrypted backup', { limit: 2 });

    expect(rag.isReady()).toBe(true);
    expect(results.map((result) => result.chunk.chatId)).toEqual(['chat-restore', 'chat-restore']);
    expect(results[0].chunk.messageId).toBe('m2');
    expect(results[0]).not.toHaveProperty('answer');
    expect(results[0].chunk.excerpt).toContain('encrypted vault backup');
  });

  it('chunks long messages with overlap and stable source IDs', () => {
    const LocalRAG = loadLocalRAG();
    const longMessage = {
      messageId: 'long-1',
      chatId: 'chat-restore',
      role: 'assistant',
      content: Array.from({ length: 500 }, (_, index) => 'word' + index).join(' '),
      index: 0
    };
    const chunks = LocalRAG.createChunks([chats()[0]], [longMessage], { maxWords: 100, overlapWords: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].messageId).toBe('long-1');
    expect(chunks[1].text).toContain('word80');
    expect(chunks[1].text).toContain('word99');
    expect(new Set(chunks.map((chunk) => chunk.chunkId)).size).toBe(chunks.length);
  });

  it('cancels index builds without publishing partial chunks and can restart', async () => {
    const LocalRAG = loadLocalRAG();
    const controller = new AbortController();
    const rag = LocalRAG.create({
      dao: {
        listChats: async () => chats(),
        listAllMessages: async () => messages()
      },
      embedder: fakeEmbedder()
    });

    await expect(rag.build({
      batchSize: 1,
      signal: controller.signal,
      onProgress() {
        controller.abort();
      }
    })).rejects.toThrow('RAG index build cancelled');
    expect(rag.isReady()).toBe(false);
    expect(rag.getChunks()).toEqual([]);

    await expect(rag.build({ batchSize: 2 })).resolves.toMatchObject({ chunkCount: 3 });
    expect(rag.isReady()).toBe(true);
  });

  it('downloads model pipeline and clears model cache separately from vector index', async () => {
    const LocalRAG = loadLocalRAG();
    const calls = [];
    const loader = {
      DEFAULT_CACHE_KEY: 'rakuzaichi-transformers-cache',
      async loadModel(modelId, options) {
        calls.push({ type: 'load', modelId, options });
        if (options.onProgress) options.onProgress({ status: 'ready' });
        return { modelId };
      },
      clearLoadedModels() {
        calls.push({ type: 'clear-loaded' });
      }
    };
    const deleted = [];
    const cacheApi = {
      async delete(key) {
        deleted.push(key);
        return true;
      }
    };
    const rag = LocalRAG.create({
      dao: {
        listChats: async () => chats(),
        listAllMessages: async () => messages()
      },
      embedder: fakeEmbedder(),
      modelLoader: loader
    });

    await expect(rag.downloadModel()).resolves.toMatchObject({
      modelId: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'q8',
      backend: 'wasm'
    });
    expect(rag.isModelReady()).toBe(true);
    expect(calls[0]).toMatchObject({ type: 'load', modelId: 'Xenova/all-MiniLM-L6-v2' });

    await rag.build();
    expect(rag.isReady()).toBe(true);
    rag.clear();
    expect(rag.isReady()).toBe(false);
    expect(rag.getChunks()).toEqual([]);

    await expect(rag.clearModelCache({ caches: cacheApi })).resolves.toMatchObject({
      clearedCaches: 1,
      cacheKeys: ['rakuzaichi-transformers-cache']
    });
    expect(rag.isModelReady()).toBe(false);
    expect(deleted).toEqual(['rakuzaichi-transformers-cache']);
    expect(calls.at(-1)).toEqual({ type: 'clear-loaded' });
  });
});
