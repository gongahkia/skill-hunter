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

function loadRuntime() {
  globalThis.indexedDB = indexedDB;
  return evalSrc('vault/db.js', 'vault/dao.js', 'background-core.js');
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
});
