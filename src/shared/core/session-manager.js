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
            const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);

            if (sessionExpiresAt) {
                const isActiveLocally = Date.now() < sessionExpiresAt;

                if (isActiveLocally) {
                    logger.debug('Active session found locally', {
                        expiresAt: new Date(sessionExpiresAt).toISOString(),
                    });
                    return true;
                }
            }

            // Check backend for authoritative session status
            if (extensionId) {
                const sessionData = await backendClient.checkSession(extensionId);

                if (sessionData.has_active_session) {
                    const expiresAt = new Date(sessionData.session_expires).getTime();

                    logger.info('Active session confirmed by backend', {
                        extensionId,
                        expires: sessionData.session_expires,
                    });

                    // Sync local storage with backend
                    await this.storage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, expiresAt);
                    return true;
                }
            }

            return false;

        } catch (error) {
            logger.error('Error checking session', {
                error: error.message,
            });

            // Fallback to local storage only
            const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);
            if (sessionExpiresAt) {
                return Date.now() < sessionExpiresAt;
            }

            return false;
        }
    }

    /**
     * Get time remaining in current session (in milliseconds).
     */
    async getTimeRemaining() {
        const sessionExpiresAt = await this.storage.get(STORAGE_KEYS.SESSION_EXPIRES_AT);

        if (!sessionExpiresAt) {
            return 0;
        }

        return Math.max(0, sessionExpiresAt - Date.now());
    }

    /**
     * Start a new session after successful problem solve.
     */
    async startSession(extensionId, problemData) {
        const now = Date.now();
        let sessionExpiresAt = now + this.sessionDuration;

        // Store locally
        await this.storage.set(STORAGE_KEYS.LAST_SOLVED_TIME, now);
        await this.storage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, sessionExpiresAt);

        logger.info('Session started', {
            extensionId,
            problemSlug: problemData.slug,
            expiresAt: new Date(sessionExpiresAt).toISOString(),
        });

        // Sync with backend
        try {
            const response = await backendClient.submitSolution({
                extension_id: extensionId,
                problem_slug: problemData.slug,
                problem_title: problemData.title,
                difficulty: problemData.difficulty,
                source: problemData.source || 'leetcode',
                challenge_id: problemData.challenge_id || '',
                topic_tags: problemData.topic_tags || [],
                time_taken_seconds: problemData.timeTaken || null,
            });

            if (response.session_expires) {
                sessionExpiresAt = new Date(response.session_expires).getTime();
                await this.storage.set(STORAGE_KEYS.SESSION_EXPIRES_AT, sessionExpiresAt);
            }

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
        await this.storage.remove(STORAGE_KEYS.SESSION_EXPIRES_AT);
        logger.info('Session ended');
    }

    /**
     * Get session information.
     */
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
