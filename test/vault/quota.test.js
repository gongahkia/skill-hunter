import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { createVaultDAO } from '../../src/vault/dao.js';
import { createVaultQuota } from '../../src/vault/quota.js';

const MB = 1024 * 1024;
const dbs = [];

function dbName() {
  const name = `rakuzaichi-quota-test-${Date.now()}-${Math.random()}`;
  dbs.push(name);
  return name;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteDatabase(name) {
  await requestToPromise(indexedDB.deleteDatabase(name));
}

function iso(minutes) {
  return new Date(Date.UTC(2026, 0, 1, 0, minutes, 0)).toISOString();
}

afterEach(async () => {
  while (dbs.length) await deleteDatabase(dbs.pop());
});

describe('VaultQuota', () => {
  it('returns populated usage fields when storage estimate is available', async () => {
    const quota = createVaultQuota({
      navigator: {
        storage: {
          estimate: async () => ({ usage: 50 * MB, quota: 200 * MB })
        }
      }
    });

    await expect(quota.getQuotaUsage()).resolves.toEqual({
      usageMB: 50,
      quotaMB: 200,
      percent: 25,
      supported: true
    });
  });

  it('returns sentinel values when storage estimate is unavailable', async () => {
    const quota = createVaultQuota({ navigator: {} });
    await expect(quota.getQuotaUsage()).resolves.toEqual({
      usageMB: 0,
      quotaMB: 0,
      percent: 0,
      supported: false
    });
  });

  it('auto-prunes oldest unpinned chats until usage falls below 75 percent', async () => {
    const name = dbName();
    const dao = createVaultDAO({ indexedDB, name });

    for (let i = 0; i < 100; i++) {
      await dao.putChat({
        chatId: `chat-${i}`,
        platform: 'chatgpt',
        title: `Chat ${i}`,
        url: `https://chatgpt.com/c/${i}`,
        capturedAt: iso(i),
        lastUpdatedAt: iso(i),
        messageCount: 0,
        pinned: i % 20 === 0,
        archived: false,
        tags: [],
        sizeMB: 2
      });
    }

    const navigator = {
      storage: {
        estimate: async () => {
          const chats = await dao.listChats();
          const usageMB = chats.reduce((sum, chat) => sum + chat.sizeMB, 0);
          return { usage: usageMB * MB, quota: 100 * MB };
        }
      }
    };
    const quota = createVaultQuota({ dao, navigator });

    const result = await quota.autoPruneVault();
    const remaining = await dao.listChats();
    const remainingIds = new Set(remaining.map((chat) => chat.chatId));

    expect(result.before.percent).toBe(200);
    expect(result.after.percent).toBeLessThan(75);
    expect(result.deletedChatIds.length).toBeGreaterThan(0);
    expect(remainingIds.has('chat-0')).toBe(true);
    expect(remainingIds.has('chat-20')).toBe(true);
    expect(remainingIds.has('chat-1')).toBe(false);
    expect(remaining.every((chat) => chat.pinned || !result.deletedChatIds.includes(chat.chatId))).toBe(true);
  });
});
