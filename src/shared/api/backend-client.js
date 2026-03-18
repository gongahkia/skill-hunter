/**
 * API client for communicating with Django backend.
 */

import { BACKEND_API_URL } from '../core/constants.js';
import logger from '../utils/logger.js';

class BackendClient {
    constructor(baseURL = BACKEND_API_URL) {
        this.baseURL = baseURL;
    }

    async _fetch(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            logger.error('Backend API request failed', {
                endpoint,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Register or update extension user.
     */
    async registerUser(extensionId, browser = 'chrome') {
        return this._fetch('/users/register/', {
            method: 'POST',
            body: JSON.stringify({
                extension_id: extensionId,
                browser,
            }),
        });
    }

    /**
     * Check if user has an active session.
     */
    async checkSession(extensionId) {
        return this._fetch(`/users/check-session/?extension_id=${extensionId}`, {
            method: 'GET',
        });
    }

    /**
     * Get random LeetCode problem.
     */
    async getRandomProblem(extensionId) {
        const query = extensionId ? `?extension_id=${encodeURIComponent(extensionId)}` : '';
        return this._fetch(`/problems/random/${query}`, {
            method: 'GET',
        });
    }

    /**
     * Submit a successfully solved problem.
     */
    async submitSolution(data) {
        return this._fetch('/problems/submit/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Log a problem attempt (failed or in-progress).
     */
    async logAttempt(data) {
        return this._fetch('/problems/attempt/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Log chatbot access.
     */
    async logAccess(extensionId, chatbotUrl, chatbotName, problemAttemptId = null) {
        return this._fetch('/users/log-access/', {
            method: 'POST',
            body: JSON.stringify({
                extension_id: extensionId,
                chatbot_url: chatbotUrl,
                chatbot_name: chatbotName,
                problem_solved_for_access: problemAttemptId,
            }),
        });
    }

    /**
     * Get user statistics.
     */
    async getUserStats(extensionId) {
        return this._fetch(`/users/${extensionId}/stats/`, {
            method: 'GET',
        });
    }

    /**
     * Get and update saved user preferences.
     */
    async getPreferences(extensionId) {
        return this._fetch(`/users/${extensionId}/preferences/`, {
            method: 'GET',
        });
    }

    async updatePreferences(extensionId, data) {
        return this._fetch(`/users/${extensionId}/preferences/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    /**
     * Get and update linked external identities.
     */
    async getIdentities(extensionId) {
        return this._fetch(`/users/${extensionId}/identities/`, {
            method: 'GET',
        });
    }

    async updateIdentities(extensionId, data) {
        return this._fetch(`/users/${extensionId}/identities/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    /**
     * Verify that a linked Codeforces account solved the assigned problem.
     */
    async verifyCodeforces(extensionId, challengeId, assignedAt) {
        return this._fetch('/problems/verify-codeforces/', {
            method: 'POST',
            body: JSON.stringify({
                extension_id: extensionId,
                challenge_id: challengeId,
                assigned_at: assignedAt,
            }),
        });
    }

    /**
     * Fetch curated practice-only problems from catalog sources.
     */
    async getPracticeDeck() {
        return this._fetch('/problems/practice-deck/', {
            method: 'GET',
        });
    }
}

export default new BackendClient();
export { BackendClient };
