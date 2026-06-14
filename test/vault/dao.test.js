import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { VaultDB } from '../../src/vault/db.js';
import { createVaultDAO } from '../../src/vault/dao.js';

const dbs = [];

function dbName() {
  const name = `rakuzaichi-dao-test-${Date.now()}-${Math.random()}`;
  dbs.push(name);
  return name;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function deleteDatabase(name) {
  await requestToPromise(indexedDB.deleteDatabase(name));
}

async function seedExtractionRun(name, run) {
  const db = await VaultDB.open({ indexedDB, name });
  const transaction = db.transaction(['extractionRuns'], 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('extractionRuns').put(run);
  await done;
  VaultDB.close(db);
}

async function listExtractionRuns(name, chatId) {
  const db = await VaultDB.open({ indexedDB, name });
  const transaction = db.transaction(['extractionRuns'], 'readonly');
  const done = transactionDone(transaction);
  const rows = await requestToPromise(transaction.objectStore('extractionRuns').index('chatId').getAll(chatId));
  await done;
  VaultDB.close(db);
  return rows;
}

function makeDAO(name) {
  return createVaultDAO({ indexedDB, name });
}

afterEach(async () => {
  while (dbs.length) await deleteDatabase(dbs.pop());
});

describe('VaultDAO', () => {
  it('handles chat, message, thread, status, and delete happy paths', async () => {
    const name = dbName();
    const dao = makeDAO(name);
    const chat = {
      chatId: 'chat-1',
      platform: 'chatgpt',
      title: 'Test chat',
      url: 'https://chatgpt.com/c/chat-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-01T00:01:00.000Z',
      messageCount: 2,
      pinned: false,
      archived: false,
      tags: []
    };

    await dao.putChat(chat);
    expect(await dao.getChat('chat-1')).toMatchObject({ title: 'Test chat' });
    expect(await dao.listChats({ platform: 'chatgpt' })).toHaveLength(1);

    await dao.putMessages('chat-1', [
      { messageId: 'msg-2', role: 'assistant', content: 'A', index: 1, timestamp: '2026-01-01T00:01:00.000Z' },
      { messageId: 'msg-1', role: 'user', content: 'Q', index: 0, timestamp: '2026-01-01T00:00:00.000Z' }
    ]);
    expect((await dao.listMessages('chat-1')).map((message) => message.messageId)).toEqual(['msg-1', 'msg-2']);
    expect((await dao.listAllMessages()).map((message) => message.messageId)).toEqual(['msg-1', 'msg-2']);
    await dao.setMeta('searchIndex', { version: 1, count: 1 });
    expect(await dao.getMeta('searchIndex')).toEqual({ version: 1, count: 1 });

    await dao.putOpenThreads([
      {
        threadId: 'thread-1',
        chatId: 'chat-1',
        messageId: 'msg-1',
        tag: 'TODO',
        text: 'follow up',
        source: 'explicit',
        status: 'open',
        createdAt: '2026-01-01T00:02:00.000Z'
      },
      {
        threadId: 'thread-2',
        chatId: 'chat-1',
        messageId: 'msg-2',
        tag: 'REF',
        text: 'source',
        source: 'extracted',
        status: 'archived',
        createdAt: '2026-01-01T00:03:00.000Z'
      }
    ]);
    expect(await dao.listOpenThreads({ chatId: 'chat-1', status: 'open' })).toHaveLength(1);

    const updated = await dao.setThreadStatus('thread-1', 'done');
    expect(updated.status).toBe('done');
    expect(updated.resolvedAt).toBeTruthy();

    await seedExtractionRun(name, {
      runId: 'run-1',
      chatId: 'chat-1',
      modelName: 'test',
      modelVersion: '1',
      completedAt: '2026-01-01T00:04:00.000Z',
      threadCount: 2,
      durationMs: 10
    });

    expect(await dao.deleteChat('chat-1')).toBe(true);
    expect(await dao.getChat('chat-1')).toBeNull();
    expect(await dao.listMessages('chat-1')).toEqual([]);
    expect(await dao.listOpenThreads({ chatId: 'chat-1' })).toEqual([]);
    expect(await listExtractionRuns(name, 'chat-1')).toEqual([]);
  });

  it('handles missing keys predictably', async () => {
    const dao = makeDAO(dbName());

    await expect(dao.putChat({ title: 'missing id' })).rejects.toThrow('chatId is required');
    await expect(dao.putMessages('', [])).rejects.toThrow('chatId is required');
    await expect(dao.putOpenThreads(null)).rejects.toThrow('threads must be an array');
    await expect(dao.setThreadStatus('', 'done')).rejects.toThrow('threadId is required');
    await expect(dao.deleteChat('')).rejects.toThrow('chatId is required');

    expect(await dao.getChat('missing')).toBeNull();
    expect(await dao.listChats({ platform: 'missing' })).toEqual([]);
    expect(await dao.listMessages('missing')).toEqual([]);
    expect(await dao.listOpenThreads({ chatId: 'missing' })).toEqual([]);
    expect(await dao.setThreadStatus('missing', 'done')).toBeNull();
    expect(await dao.deleteChat('missing')).toBe(false);
  });

  it('toggles pinned chats and sorts pinned rows first', async () => {
    const dao = makeDAO(dbName());
    await dao.putChat({
      chatId: 'older',
      platform: 'chatgpt',
      title: 'Older',
      capturedAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
      pinned: false,
      archived: false,
      tags: []
    });
    await dao.putChat({
      chatId: 'newer',
      platform: 'chatgpt',
      title: 'Newer',
      capturedAt: '2026-01-02T00:00:00.000Z',
      lastUpdatedAt: '2026-01-02T00:00:00.000Z',
      messageCount: 0,
      pinned: false,
      archived: false,
      tags: []
    });

    expect((await dao.listChats()).map((chat) => chat.chatId)).toEqual(['newer', 'older']);
    await expect(dao.setChatPinned('older', true)).resolves.toMatchObject({ pinned: true });
    expect((await dao.listChats()).map((chat) => chat.chatId)).toEqual(['older', 'newer']);
    await expect(dao.setChatPinned('missing', true)).resolves.toBeNull();
  });

  it('summarizes vault stats by chat, message, date, and platform', async () => {
    const dao = makeDAO(dbName());
    await dao.putChat({
      chatId: 'old',
      platform: 'chatgpt',
      title: 'Old chat',
      capturedAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 2,
      pinned: false,
      archived: false,
      tags: []
    });
    await dao.putChat({
      chatId: 'new',
      platform: 'claude',
      title: 'New chat',
      capturedAt: '2026-01-03T00:00:00.000Z',
      lastUpdatedAt: '2026-01-03T00:00:00.000Z',
      messageCount: 5,
      pinned: false,
      archived: false,
      tags: []
    });
    await dao.putChat({
      chatId: 'middle',
      platform: 'chatgpt',
      title: 'Middle chat',
      capturedAt: '2026-01-02T00:00:00.000Z',
      lastUpdatedAt: '2026-01-02T00:00:00.000Z',
      messageCount: 3,
      pinned: false,
      archived: false,
      tags: []
    });

    await expect(dao.getStats()).resolves.toMatchObject({
      totalChats: 3,
      totalMessages: 10,
      oldestChat: { chatId: 'old' },
      newestChat: { chatId: 'new' },
      perPlatform: [
        { platform: 'chatgpt', chats: 2, messages: 5 },
        { platform: 'claude', chats: 1, messages: 5 }
      ]
    });
  });

  it('creates nested folders, moves chats, and deletes folder subtrees', async () => {
    const dao = makeDAO(dbName());
    await dao.putChat({
      chatId: 'chat-1',
      platform: 'chatgpt',
      title: 'Folder chat',
      capturedAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
      pinned: false,
      archived: false,
      tags: []
    });

    await dao.putFolder({ folderId: 'folder-1', name: 'Work' });
    await dao.putFolder({ folderId: 'folder-2', name: 'Client', parentId: 'folder-1' });
    await dao.putFolder({ folderId: 'folder-3', name: 'Sprint', parentId: 'folder-2' });
    await expect(dao.putFolder({ folderId: 'folder-4', name: 'Too deep', parentId: 'folder-3' })).rejects.toThrow('folders can only be nested up to 3 levels');

    await expect(dao.listFolders()).resolves.toHaveLength(3);
    await expect(dao.renameFolder('folder-2', 'Client A')).resolves.toMatchObject({ name: 'Client A' });
    await expect(dao.setChatFolder('chat-1', 'folder-3')).resolves.toMatchObject({ folderId: 'folder-3' });
    await expect(dao.setChatTags('chat-1', ['custom', 'custom', ' REF '])).resolves.toMatchObject({ tags: ['custom', 'REF'] });
    await expect(dao.setChatFolder('missing', 'folder-3')).resolves.toBeNull();
    await expect(dao.setChatTags('missing', ['custom'])).resolves.toBeNull();
    await expect(dao.setChatTags('chat-1', null)).rejects.toThrow('tags must be an array');
    await expect(dao.setChatFolder('chat-1', 'missing')).rejects.toThrow('folder not found');

    await expect(dao.deleteFolder('folder-1')).resolves.toBe(true);
    await expect(dao.listFolders()).resolves.toEqual([]);
    await expect(dao.getChat('chat-1')).resolves.not.toHaveProperty('folderId');
  });

  it('rolls back batched message writes when one row is invalid', async () => {
    const dao = makeDAO(dbName());

    await expect(dao.putMessages('chat-1', [
      { messageId: 'msg-1', role: 'user', content: 'Q', index: 0 },
      { role: 'assistant', content: 'missing key', index: 1 }
    ])).rejects.toThrow();

    expect(await dao.listMessages('chat-1')).toEqual([]);
  });

  it('rolls back batched open-thread writes when one row is invalid', async () => {
    const dao = makeDAO(dbName());

    await expect(dao.putOpenThreads([
      { threadId: 'thread-1', chatId: 'chat-1', messageId: 'msg-1', tag: 'TODO', text: 'x', source: 'explicit', status: 'open' },
      { chatId: 'chat-1', messageId: 'msg-2', tag: 'REF', text: 'missing key', source: 'explicit', status: 'open' }
    ])).rejects.toThrow();

    expect(await dao.listOpenThreads({ chatId: 'chat-1' })).toEqual([]);
  });

  it('opens and closes a fresh database connection per DAO call', async () => {
    const name = dbName();
    let opens = 0;
    let closes = 0;
    const db = {
      open: async () => {
        opens++;
        return VaultDB.open({ indexedDB, name });
      },
      close: (handle) => {
        closes++;
        VaultDB.close(handle);
      }
    };
    const dao = createVaultDAO({ db });

    await dao.putChat({
      chatId: 'chat-1',
      platform: 'chatgpt',
      title: 'Chat',
      capturedAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
      pinned: false,
      archived: false,
      tags: []
    });
    await dao.getChat('chat-1');

    expect(opens).toBe(2);
    expect(closes).toBe(2);
  });
});
