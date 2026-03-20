/**
 * Session Manager - Handles purely local session logic for the public store build.
 */

import { SESSION_DURATION_MS, STORAGE_KEYS } from './constants.js';
import logger from '../utils/logger.js';

class SessionManager {
    constructor(storageAdapter) {
        this.storage = storageAdapter;
        this.sessionDuration = SESSION_DURATION_MS;
    }

    setStorage(storageAdapter) {
        this.storage = storageAdapter;
    }

    async hasActiveSession() {
        const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);

        if (!sessionExpiresAt) {
            return false;
        }

        const isActive = Date.now() < sessionExpiresAt;
        if (!isActive) {
            await this.endSession();
        }

        return isActive;
    }

    async getTimeRemaining() {
        const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);

        if (!sessionExpiresAt) {
            return 0;
        }

        return Math.max(0, sessionExpiresAt - Date.now());
    }

    async startSession(extensionIdOrProblemData = {}, maybeProblemData = null) {
        const problemData = typeof extensionIdOrProblemData === 'string'
            ? (maybeProblemData || {})
            : extensionIdOrProblemData;
        const now = Date.now();
        const sessionExpiresAt = now + this.sessionDuration;

        await this.storage.set(STORAGE_KEYS.LAST_SOLVED_TIME, now);
        await this.storage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, sessionExpiresAt);

        logger.info('Local session started', {
            problemSlug: problemData.slug,
            expiresAt: new Date(sessionExpiresAt).toISOString(),
        });
    }

    async endSession() {
        await this.storage.remove(STORAGE_KEYS.LAST_SOLVED_TIME);
        await this.storage.remove(STORAGE_KEYS.SESSION_EXPIRES_AT);
        logger.info('Local session ended');
    }

    async getSessionInfo() {
        const lastSolvedTime = await this.storage.get(STORAGE_KEYS.LAST_SOLVED_TIME);
        const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);

        if (!lastSolvedTime || !sessionExpiresAt) {
            return {
                isActive: false,
                timeRemaining: 0,
            };
        }

        const timeRemaining = await this.getTimeRemaining();
        const isActive = timeRemaining > 0;

        if (!isActive) {
            return {
                isActive: false,
                timeRemaining: 0,
            };
        }

        return {
            isActive,
            lastSolvedTime: new Date(lastSolvedTime).toISOString(),
            timeRemaining,
            expiresAt: new Date(sessionExpiresAt).toISOString(),
        };
    }
}

export default SessionManager;
export { SessionManager };
