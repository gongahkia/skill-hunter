/**
 * Session Manager - Handles user session logic and state.
 */

import { SESSION_DURATION_MS, STORAGE_KEYS } from './constants.js';
import logger from '../utils/logger.js';
import backendClient from '../api/backend-client.js';

class SessionManager {
    constructor(storageAdapter) {
        this.storage = storageAdapter;
        this.sessionDuration = SESSION_DURATION_MS;
    }

    /**
     * Initialize session manager with storage adapter.
     */
    setStorage(storageAdapter) {
        this.storage = storageAdapter;
    }

    /**
     * Check if user has an active session.
     * Checks both local storage and backend.
     */
    async hasActiveSession(extensionId) {
        try {
            // First check local storage for quick response
            const lastSolvedTime = await this.storage.get(STORAGE_KEYS.LAST_SOLVED_TIME);

            if (lastSolvedTime) {
                const timeSinceLastSolve = Date.now() - lastSolvedTime;
                const isActiveLocally = timeSinceLastSolve < this.sessionDuration;

                if (isActiveLocally) {
                    logger.debug('Active session found locally', {
                        lastSolved: new Date(lastSolvedTime).toISOString(),
                    });
                    return true;
                }
            }

            // Check backend for authoritative session status
            if (extensionId) {
                const sessionData = await backendClient.checkSession(extensionId);

                if (sessionData.has_active_session) {
                    logger.info('Active session confirmed by backend', {
                        extensionId,
                        expires: sessionData.session_expires,
                    });

                    // Sync local storage with backend
                    await this.storage.set(STORAGE_KEYS.LAST_SOLVED_TIME, Date.now());
                    return true;
                }
            }

            return false;

        } catch (error) {
            logger.error('Error checking session', {
                error: error.message,
            });

            // Fallback to local storage only
            const lastSolvedTime = await this.storage.get(STORAGE_KEYS.LAST_SOLVED_TIME);
            if (lastSolvedTime) {
                const timeSinceLastSolve = Date.now() - lastSolvedTime;
                return timeSinceLastSolve < this.sessionDuration;
            }

            return false;
        }
    }

    /**
     * Get time remaining in current session (in milliseconds).
     */
    async getTimeRemaining() {
        const lastSolvedTime = await this.storage.get(STORAGE_KEYS.LAST_SOLVED_TIME);

        if (!lastSolvedTime) {
            return 0;
        }

        const timeSinceLastSolve = Date.now() - lastSolvedTime;
        const remaining = this.sessionDuration - timeSinceLastSolve;

        return Math.max(0, remaining);
    }

    /**
     * Start a new session after successful problem solve.
     */
    async startSession(extensionId, problemData) {
        const now = Date.now();

        // Store locally
        await this.storage.set(STORAGE_KEYS.LAST_SOLVED_TIME, now);

        logger.info('Session started', {
            extensionId,
            problemSlug: problemData.slug,
            expiresAt: new Date(now + this.sessionDuration).toISOString(),
        });

        // Sync with backend
        try {
            await backendClient.submitSolution({
                extension_id: extensionId,
                problem_slug: problemData.slug,
                problem_title: problemData.title,
                difficulty: problemData.difficulty,
                time_taken_seconds: problemData.timeTaken || null,
            });

            logger.info('Session synced with backend', { extensionId });

        } catch (error) {
            logger.error('Failed to sync session with backend', {
                error: error.message,
                extensionId,
            });
            // Continue anyway - local session is still valid
        }
    }

    /**
     * End the current session.
     */
    async endSession() {
        await this.storage.remove(STORAGE_KEYS.LAST_SOLVED_TIME);
        logger.info('Session ended');
    }

    /**
     * Get session information.
     */
    async getSessionInfo() {
        const lastSolvedTime = await this.storage.get(STORAGE_KEYS.LAST_SOLVED_TIME);

        if (!lastSolvedTime) {
            return {
                isActive: false,
                timeRemaining: 0,
            };
        }

        const timeRemaining = await this.getTimeRemaining();
        const isActive = timeRemaining > 0;

        return {
            isActive,
            lastSolvedTime: new Date(lastSolvedTime).toISOString(),
            timeRemaining,
            expiresAt: new Date(lastSolvedTime + this.sessionDuration).toISOString(),
        };
    }
}

export default SessionManager;
export { SessionManager };
