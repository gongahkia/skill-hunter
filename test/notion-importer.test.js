import { describe, expect, it } from 'vitest';
import { loadFixture, loadSrc } from './helpers.js';

function loadImporter() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('imports/notion.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code);
  fn(module, module.exports);
  return module.exports;
}

function fixture(name) {
  return JSON.parse(loadFixture('fixtures/imports/notion/' + name + '.json'));
}

function response(status, body, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name) => normalized[String(name).toLowerCase()] },
    json: async () => body
  };
}

function mockFetch(doc, options = {}) {
  const calls = [];
  const responseByBlock = new Map();
  (doc.responses || []).forEach((item) => {
    if (!responseByBlock.has(item.block_id)) responseByBlock.set(item.block_id, []);
    responseByBlock.get(item.block_id).push(item);
  });
  const retryState = {};

  const fetcher = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed.pathname + parsed.search);
    if (parsed.pathname.indexOf('/v1/pages/') === 0) return response(200, doc.page);
    const match = parsed.pathname.match(/\/v1\/blocks\/(.+)\/children/);
    if (!match) return response(404, { code: 'object_not_found', message: 'missing' });
    const blockId = decodeURIComponent(match[1]);
    if (options.rateLimitBlock === blockId && !retryState[blockId]) {
      retryState[blockId] = true;
      return response(429, { code: 'rate_limited', message: 'slow down' }, { 'retry-after': '0' });
    }
    const rows = responseByBlock.get(blockId) || [];
    const index = parsed.searchParams.get('start_cursor') === 'cursor-2' ? 1 : parsed.searchParams.get('start_cursor') === 'cursor-3' ? 2 : 0;
    return response(200, rows[index] || { has_more: false, next_cursor: null, results: [] });
  };
  fetcher.calls = calls;
  return fetcher;
}

describe('NotionImporter', () => {
  it('imports a selected page with recursive child blocks and scanner output', async () => {
    const importer = loadImporter();
    const doc = fixture('nested-blocks');
    const fetcher = mockFetch(doc);
    const result = await importer.importPage({
      token: 'secret',
      pageId: 'page-nested',
      fetch: fetcher,
      sleep: async () => {},
      importedAt: '2026-06-18T10:00:00.000Z'
    });

    expect(result.chat).toMatchObject({
      chatId: 'notion:page:page-nested',
      platform: 'notion',
      title: 'Nested Notion fixture',
      messageCount: 5
    });
    expect(result.messages.map((message) => message.metadata.provenance.blockId)).toEqual([
      'toggle-1',
      'toggle-child-1',
      'toggle-child-2',
      'callout-1',
      'callout-child-1'
    ]);
    expect(result.openThreads).toHaveLength(1);
    expect(result.openThreads[0]).toMatchObject({
      tag: 'FIXME',
      text: 'verify recursive pagination',
      source: 'explicit',
      subSource: 'scan'
    });
    expect(fetcher.calls).toContain('/v1/blocks/toggle-1/children?page_size=50');
  });

  it('retries 429 responses using Retry-After', async () => {
    const importer = loadImporter();
    const doc = fixture('basic-page');
    const sleeps = [];
    const fetcher = mockFetch(doc, { rateLimitBlock: 'page-basic' });

    const result = await importer.importPage({
      token: 'secret',
      pageId: 'page-basic',
      fetch: fetcher,
      sleep: async (ms) => sleeps.push(ms),
      importedAt: '2026-06-18T10:10:00.000Z'
    });

    expect(sleeps).toEqual([0]);
    expect(result.run.metadata.warnings[0]).toMatchObject({ code: 'NOTION_RATE_LIMIT', sourceRef: '/blocks/page-basic/children?page_size=50' });
    expect(result.messages).toHaveLength(8);
  });

  it('records cancellation with a partial import run', async () => {
    const importer = loadImporter();
    const doc = fixture('basic-page');
    const controller = new AbortController();
    const result = await importer.importPage({
      token: 'secret',
      pageId: 'page-basic',
      fetch: mockFetch(doc),
      sleep: async () => {},
      signal: controller.signal,
      importedAt: '2026-06-18T10:20:00.000Z',
      onProgress: (event) => {
        if (event.phase === 'blocks') controller.abort();
      }
    });

    expect(result.cancelled).toBe(true);
    expect(result.run.metadata.status).toBe('cancelled');
    expect(result.messages).toEqual([]);
  });

  it('persists imported rows when a DAO is supplied', async () => {
    const importer = loadImporter();
    const doc = fixture('basic-page');
    const writes = { chats: [], messages: [], threads: [], runs: [] };
    const dao = {
      putChat: async (chat) => writes.chats.push(chat),
      putMessages: async (_chatId, messages) => writes.messages.push(...messages),
      putOpenThreads: async (threads) => writes.threads.push(...threads),
      putExtractionRun: async (run) => writes.runs.push(run)
    };

    const result = await importer.importPage({
      token: 'secret',
      pageId: 'page-basic',
      fetch: mockFetch(doc),
      sleep: async () => {},
      dao,
      importedAt: '2026-06-18T10:30:00.000Z'
    });

    expect(writes.chats).toHaveLength(1);
    expect(writes.messages).toHaveLength(result.messages.length);
    expect(writes.threads).toHaveLength(result.openThreads.length);
    expect(writes.runs).toHaveLength(1);
  });
});
