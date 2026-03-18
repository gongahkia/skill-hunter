/**
 * Tests for SessionManager.
 */

import { SessionManager } from '../core/session-manager.js';
import { SESSION_DURATION_MS, STORAGE_KEYS } from '../core/constants.js';

// Mock storage adapter
class MockStorageAdapter {
  constructor() {
    this.storage = {};
  }

  async get(key) {
    return this.storage[key] || null;
  }

  async set(key, value) {
    this.storage[key] = value;
  }

  async remove(key) {
    delete this.storage[key];
  }

  async clear() {
    this.storage = {};
  }
}

describe('SessionManager', () => {
  let sessionManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorageAdapter();
    sessionManager = new SessionManager(mockStorage);
  });

  describe('hasActiveSession', () => {
    test('should return false when no session exists', async () => {
      const hasActive = await sessionManager.hasActiveSession('test-id');
      expect(hasActive).toBe(false);
    });

    test('should return true when recent session exists', async () => {
      const now = Date.now();
      await mockStorage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, now + SESSION_DURATION_MS);

      const hasActive = await sessionManager.hasActiveSession('test-id');
      expect(hasActive).toBe(true);
    });

    test('should return false when session has expired', async () => {
      const pastTime = Date.now() - 1000;
      await mockStorage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, pastTime);

      const hasActive = await sessionManager.hasActiveSession('test-id');
      expect(hasActive).toBe(false);
    });
  });

  describe('getTimeRemaining', () => {
    test('should return 0 when no session exists', async () => {
      const remaining = await sessionManager.getTimeRemaining();
      expect(remaining).toBe(0);
    });

    test('should return positive time for active session', async () => {
      const now = Date.now();
      await mockStorage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, now + SESSION_DURATION_MS);

      const remaining = await sessionManager.getTimeRemaining();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(SESSION_DURATION_MS);
    });
  });

  describe('startSession', () => {
    test('should store session start time', async () => {
      const problemData = {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
      };

      await sessionManager.startSession('test-id', problemData);

      const lastSolved = await mockStorage.get(STORAGE_KEYS.LAST_SOLVED_TIME);
      const sessionExpiresAt = await mockStorage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);
      expect(lastSolved).toBeTruthy();
      expect(sessionExpiresAt).toBeGreaterThan(lastSolved);
      expect(typeof lastSolved).toBe('number');
    });
  });

  describe('endSession', () => {
    test('should remove session data', async () => {
      await mockStorage.set(STORAGE_KEYS.LAST_SOLVED_TIME, Date.now());
      await mockStorage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, Date.now() + SESSION_DURATION_MS);
      await sessionManager.endSession();

      const lastSolved = await mockStorage.get(STORAGE_KEYS.LAST_SOLVED_TIME);
      const sessionExpiresAt = await mockStorage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);
      expect(lastSolved).toBeNull();
      expect(sessionExpiresAt).toBeNull();
    });
  });

  describe('getSessionInfo', () => {
    test('should return inactive session info when no session', async () => {
      const info = await sessionManager.getSessionInfo();

      expect(info.isActive).toBe(false);
      expect(info.timeRemaining).toBe(0);
    });

    test('should return active session info', async () => {
      const now = Date.now();
      await mockStorage.set(STORAGE_KEYS.LAST_SOLVED_TIME, now);
      await mockStorage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, now + SESSION_DURATION_MS);

      const info = await sessionManager.getSessionInfo();

      expect(info.isActive).toBe(true);
      expect(info.timeRemaining).toBeGreaterThan(0);
      expect(info.lastSolvedTime).toBeTruthy();
      expect(info.expiresAt).toBeTruthy();
    });
  });
});
