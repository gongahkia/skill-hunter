import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { evalSrc } from './helpers.js';

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteVault() {
  await requestToPromise(indexedDB.deleteDatabase('rakuzaichi-vault'));
}

function loadRuntime(api) {
  globalThis.indexedDB = indexedDB;
  return evalSrc('vault/db.js', 'vault/dao.js', 'threads/scanner.js', 'background-core.js', api ? { api } : {});
}

function snapshot(messages) {
  return {
    chatId: 'chatgpt:thread-123',
    platform: 'chatgpt',
    title: 'Thread 123',
    url: 'https://chatgpt.com/c/thread-123',
    model: 'GPT-4o',
    capturedAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-01T00:01:00.000Z',
    pinned: false,
    archived: false,
    tags: [],
    messages: messages
  };
}

afterEach(async () => {
  await deleteVault();
  delete globalThis.indexedDB;
});

describe('BackgroundRuntime.handleCapture', () => {
  it('upserts chats and does not duplicate messages on repeated capture', async () => {
    const { BackgroundRuntime, VaultDAO } = loadRuntime();
    const baseMessages = [
      { messageId: 'msg-1', role: 'user', content: 'Q', index: 0, timestamp: '2026-01-01T00:00:00.000Z' },
      { messageId: 'msg-2', role: 'assistant', content: 'A', index: 1, timestamp: '2026-01-01T00:01:00.000Z' }
    ];

    const first = await BackgroundRuntime.handleCapture(snapshot(baseMessages));
    const second = await BackgroundRuntime.handleCapture(snapshot(baseMessages));

    expect(first.addedMessages).toBe(2);
    expect(second.addedMessages).toBe(0);
    expect(await VaultDAO.listMessages('chatgpt:thread-123')).toHaveLength(2);

    const third = await BackgroundRuntime.handleCapture(snapshot(baseMessages.concat([
      { messageId: 'msg-3', role: 'user', content: 'Follow-up', index: 2, timestamp: '2026-01-01T00:02:00.000Z' }
    ])));

    expect(third.addedMessages).toBe(1);
    expect(await VaultDAO.listMessages('chatgpt:thread-123')).toHaveLength(3);
    await expect(VaultDAO.getChat('chatgpt:thread-123')).resolves.toMatchObject({
      platform: 'chatgpt',
      title: 'Thread 123',
      messageCount: 3
    });
  });

  it('scans captured tag prefixes into open-thread rows', async () => {
    const { BackgroundRuntime, VaultDAO } = loadRuntime();
    const taggedMessages = [
      { messageId: 'msg-1', role: 'user', content: 'TODO: ping Alice\nTODOLIST: ignore this\nref: source doc', index: 0, timestamp: '2026-01-01T00:00:00.000Z' },
      { messageId: 'msg-2', role: 'assistant', content: 'No tags here.', index: 1, timestamp: '2026-01-01T00:01:00.000Z' }
    ];

    const first = await BackgroundRuntime.handleCapture(snapshot(taggedMessages));
    const second = await BackgroundRuntime.handleCapture(snapshot(taggedMessages));
    const rows = await VaultDAO.listOpenThreads({ chatId: 'chatgpt:thread-123' });

    expect(first.openThreadCount).toBe(2);
    expect(second.openThreadCount).toBe(0);
    expect(rows.map((row) => row.tag)).toEqual(['TODO', 'REF']);
    expect(rows.map((row) => row.text)).toEqual(['ping Alice', 'source doc']);
    expect(rows[0]).toMatchObject({
      chatId: 'chatgpt:thread-123',
      messageId: 'msg-1',
      source: 'explicit',
      subSource: 'scan',
      status: 'open'
    });
  });

  it('captures supported completed tab updates once per throttle window', async () => {
    let sends = 0;
    const api = {
      storage: {
        local: { get: async (defaults) => defaults, set: async () => {} },
        onChanged: { addListener() {} }
      },
      runtime: { onMessage: { addListener() {} }, sendMessage: async () => ({}) },
      downloads: { download: async () => {} },
      alarms: { create() {}, clear: async () => {}, onAlarm: { addListener() {} } },
      tabs: {
        query: async () => [],
        onUpdated: { addListener() {} },
        sendMessage: async () => {
          sends++;
          return { data: snapshot([
            { messageId: 'msg-1', role: 'user', content: 'Q', index: 0 },
            { messageId: 'msg-2', role: 'assistant', content: 'A', index: 1 }
          ]) };
        }
      }
    };
    const { BackgroundRuntime, VaultDAO } = loadRuntime(api);

    const first = await BackgroundRuntime.handleTabUpdated(10, { status: 'complete' }, { url: 'https://chatgpt.com/c/thread-123' });
    const second = await BackgroundRuntime.handleTabUpdated(10, { status: 'complete' }, { url: 'https://chatgpt.com/c/thread-123' });

    expect(first.success).toBe(true);
    expect(second).toEqual({ skipped: true, reason: 'throttled' });
    expect(sends).toBe(1);
    expect(await VaultDAO.listMessages('chatgpt:thread-123')).toHaveLength(2);
    await expect(VaultDAO.listExtractionRuns({ chatId: 'chatgpt:thread-123' })).resolves.toHaveLength(1);
  });

  it('sweeps the active supported tab and skips unsupported active tabs', async () => {
    let sends = 0;
    const api = {
      storage: {
        local: { get: async (defaults) => defaults, set: async () => {} },
        onChanged: { addListener() {} }
      },
      runtime: { onMessage: { addListener() {} }, sendMessage: async () => ({}) },
      downloads: { download: async () => {} },
      alarms: { create() {}, clear: async () => {}, onAlarm: { addListener() {} } },
      tabs: {
        activeUrl: 'https://chatgpt.com/c/thread-123',
        query: async function() {
          return [{ id: 11, url: this.activeUrl }];
        },
        onUpdated: { addListener() {} },
        sendMessage: async () => {
          sends++;
          return { data: snapshot([
            { messageId: 'msg-1', role: 'user', content: 'Q', index: 0 }
          ]) };
        }
      }
    };
    const { BackgroundRuntime, VaultDAO } = loadRuntime(api);

    await expect(BackgroundRuntime.runCaptureSweep()).resolves.toMatchObject({ success: true });
    expect(sends).toBe(1);
    await expect(VaultDAO.listMessages('chatgpt:thread-123')).resolves.toHaveLength(1);

    api.tabs.activeUrl = 'https://example.com/';
    await expect(BackgroundRuntime.runCaptureSweep()).resolves.toEqual({ skipped: true, reason: 'unsupported-tab' });
    expect(sends).toBe(1);
  });
});
