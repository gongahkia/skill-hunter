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

function loadBackupRuntime() {
  globalThis.indexedDB = indexedDB;
  return evalSrc('vault/db.js', 'vault/dao.js', 'zip.js', 'backup.js');
}

async function seedVault(dao) {
  await dao.putFolder({ folderId: 'folder-1', name: 'Work' });
  await dao.putFolder({ folderId: 'folder-2', name: 'Client', parentId: 'folder-1' });
  await dao.putChat({
    chatId: 'chat-1',
    platform: 'chatgpt',
    title: 'Backup chat',
    capturedAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-01T00:01:00.000Z',
    messageCount: 2,
    pinned: true,
    archived: false,
    tags: ['TODO', 'client'],
    folderId: 'folder-2'
  });
  await dao.putMessages('chat-1', [
    { messageId: 'msg-1', chatId: 'chat-1', role: 'user', content: 'Q', index: 0 },
    { messageId: 'msg-2', chatId: 'chat-1', role: 'assistant', content: 'A', index: 1 }
  ]);
  await dao.putOpenThreads([
    { threadId: 'thread-1', chatId: 'chat-1', messageId: 'msg-1', tag: 'TODO', text: 'follow up', source: 'explicit', status: 'open' }
  ]);
  await dao.putExtractionRun({
    runId: 'run-1',
    chatId: 'chat-1',
    modelName: 'test',
    modelVersion: '1',
    completedAt: '2026-01-01T00:02:00.000Z',
    threadCount: 1,
    durationMs: 10
  });
}

afterEach(async () => {
  await deleteVault();
  delete globalThis.indexedDB;
});

describe('VaultBackup', () => {
  it('exports an encrypted backup and restores all vault rows plus settings', async () => {
    const { VaultDAO, VaultBackup } = loadBackupRuntime();
    const settings = {
      filenameTemplate: '{platform}_{title}.{ext}',
      customThreadTags: [{ tag: 'WAITING', color: '#123456' }]
    };
    const restoredSettings = {};
    await seedVault(VaultDAO);

    const backup = await VaultBackup.create({ dao: VaultDAO, settings, password: 'secret' });
    await expect(VaultBackup.read(backup.blob, 'wrong')).rejects.toThrow();
    const snapshot = await VaultBackup.read(backup.blob, 'secret');
    await VaultDAO.clearAll();
    const result = await VaultBackup.restore(snapshot, {
      dao: VaultDAO,
      storageManager: { setAll: async (payload) => Object.assign(restoredSettings, payload) }
    });

    expect(backup.filename).toMatch(/\.rakuzaichi-backup\.zip$/);
    expect(backup.encrypted).toBe(true);
    expect(result).toEqual({ chats: 1, messages: 2, openThreads: 1, folders: 2, extractionRuns: 1 });
    expect(await VaultDAO.listFolders()).toHaveLength(2);
    expect(await VaultDAO.getChat('chat-1')).toMatchObject({ title: 'Backup chat', tags: ['TODO', 'client'], folderId: 'folder-2' });
    expect(await VaultDAO.listMessages('chat-1')).toHaveLength(2);
    expect(await VaultDAO.listOpenThreads({ chatId: 'chat-1' })).toHaveLength(1);
    expect(await VaultDAO.listExtractionRuns({ chatId: 'chat-1' })).toHaveLength(1);
    expect(restoredSettings.customThreadTags).toEqual(settings.customThreadTags);
  });

  it('exports a readable backup without a password', async () => {
    const { VaultDAO, VaultBackup } = loadBackupRuntime();
    await seedVault(VaultDAO);

    const backup = await VaultBackup.create({ dao: VaultDAO, settings: {} });
    const snapshot = await VaultBackup.read(backup.blob);

    expect(backup.encrypted).toBe(false);
    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.messages).toHaveLength(2);
  });
});
