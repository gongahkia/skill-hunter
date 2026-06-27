import {
    CHATBOT_TARGETS,
    DEFAULT_ENABLED_SOURCES,
    INSTALL_ID_PREFIX,
    MESSAGE_ACTIONS,
    SESSION_DURATION_MS,
    SESSION_DURATION_MS_OPTIONS,
    SESSION_DURATION_MINUTES,
    STORAGE_KEYS,
    getDefaultEnabledTargetIds,
} from '../../shared/core/constants.js';
import leetcodeProvider from '../lib/providers/leetcode-provider.js';

(function backgroundWorker() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const RECENT_CHALLENGE_WINDOW = 5;
    const LEETCODE_STALENESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    let ensureInstallStatePromise = null;

    function isPromise(value) {
        return value && typeof value.then === 'function';
    }

    function callbackToPromise(invoker) {
        return new Promise((resolve, reject) => {
            invoker((result) => {
                const runtimeError = browserApi.runtime?.lastError;
                if (runtimeError) {
                    reject(new Error(runtimeError.message || String(runtimeError)));
                    return;
                }

                resolve(result);
            });
        });
    }

    async function getStorageValue(key) {
        const response = browserApi.storage.local.get([key]);
        const result = isPromise(response)
            ? await response
            : await callbackToPromise((done) => browserApi.storage.local.get([key], done));
        return result[key] ?? null;
    }

    async function getStorageValues(keys) {
        const response = browserApi.storage.local.get(keys);
        return isPromise(response)
            ? response
            : callbackToPromise((done) => browserApi.storage.local.get(keys, done));
    }

    async function setStorageValues(values) {
        const response = browserApi.storage.local.set(values);
        return isPromise(response)
            ? response
            : callbackToPromise((done) => browserApi.storage.local.set(values, done));
    }

    async function removeStorageKeys(keys) {
        const response = browserApi.storage.local.remove(keys);
        return isPromise(response)
            ? response
            : callbackToPromise((done) => browserApi.storage.local.remove(keys, done));
    }

    async function sha256Hex(value) {
        const bytes = new TextEncoder().encode(value);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function createInstallId(firstStorageWriteTimestamp) {
        const runtimeId = String(browserApi.runtime?.id || 'unknown-runtime');
        return `${INSTALL_ID_PREFIX}-${await sha256Hex(`${runtimeId}:${firstStorageWriteTimestamp}`)}`;
    }

    function getValidSessionDurationMs(value) {
        const durationMs = Number(value);
        return SESSION_DURATION_MS_OPTIONS.includes(durationMs) ? durationMs : SESSION_DURATION_MS;
    }

    function getSessionDurationMinutes(durationMs) {
        return Math.round(getValidSessionDurationMs(durationMs) / 60000);
    }

    function normalizeRecentChallengeSlugs(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .map((entry) => {
                if (typeof entry === 'string') {
                    return {
                        source: 'leetcode',
                        slug: entry,
                        timestamp: 0,
                    };
                }

                if (entry && typeof entry.source === 'string' && typeof entry.slug === 'string') {
                    return {
                        source: entry.source,
                        slug: entry.slug,
                        timestamp: Number.isFinite(entry.timestamp) ? entry.timestamp : 0,
                    };
                }

                return null;
            })
            .filter(Boolean);
    }

    async function ensureInstallStateInner() {
        const stored = await getStorageValues([
            STORAGE_KEYS.INSTALL_ID,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.IS_PAUSED,
        ]);
        const updates = {};

        if (!stored[STORAGE_KEYS.INSTALL_ID]) {
            const firstStorageWriteTimestamp = stored[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP] || Date.now();
            updates[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP] = firstStorageWriteTimestamp;
            updates[STORAGE_KEYS.INSTALL_ID] = await createInstallId(firstStorageWriteTimestamp);
        }

        if (!Array.isArray(stored[STORAGE_KEYS.ENABLED_TARGET_IDS])) {
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = getDefaultEnabledTargetIds();
        }

        if (!SESSION_DURATION_MS_OPTIONS.includes(stored[STORAGE_KEYS.SESSION_DURATION_MS_PREF])) {
            updates[STORAGE_KEYS.SESSION_DURATION_MS_PREF] = SESSION_DURATION_MS;
        }

        if (typeof stored[STORAGE_KEYS.IS_PAUSED] !== 'boolean') {
            updates[STORAGE_KEYS.IS_PAUSED] = false;
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }
    }

    async function ensureInstallState() {
        if (!ensureInstallStatePromise) {
            ensureInstallStatePromise = ensureInstallStateInner()
                .finally(() => {
                    ensureInstallStatePromise = null;
                });
        }

        return ensureInstallStatePromise;
    }

    async function hasActiveSession() {
        const expiresAt = await getStorageValue(STORAGE_KEYS.SESSION_EXPIRES_AT);
        if (!expiresAt) {
            return false;
        }

        const isActive = Date.now() < expiresAt;
        if (!isActive) {
            await removeStorageKeys([
                STORAGE_KEYS.SESSION_EXPIRES_AT,
                STORAGE_KEYS.LAST_SOLVED_TIME,
            ]);
        }

        return isActive;
    }

    async function getSessionInfo() {
        const lastSolvedTime = await getStorageValue(STORAGE_KEYS.LAST_SOLVED_TIME);
        const sessionExpiresAt = await getStorageValue(STORAGE_KEYS.SESSION_EXPIRES_AT);

        if (!lastSolvedTime || !sessionExpiresAt || Date.now() >= sessionExpiresAt) {
            return {
                isActive: false,
                timeRemaining: 0,
            };
        }

        return {
            isActive: true,
            lastSolvedTime: new Date(lastSolvedTime).toISOString(),
            timeRemaining: Math.max(0, sessionExpiresAt - Date.now()),
            expiresAt: new Date(sessionExpiresAt).toISOString(),
        };
    }

    async function getStoredState() {
        return getStorageValues([
            STORAGE_KEYS.INSTALL_ID,
            STORAGE_KEYS.CURRENT_CHALLENGE,
            STORAGE_KEYS.CHALLENGE_STARTED_AT,
            STORAGE_KEYS.RECENT_CHALLENGE_SLUGS,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.IS_PAUSED,
            STORAGE_KEYS.UI_MESSAGE,
        ]);
    }

    function getLeetCodeDetectionWarning(stored) {
        if (!DEFAULT_ENABLED_SOURCES.includes('leetcode')) {
            return '';
        }

        const lastSubmission = stored[STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP];
        const firstStorageWrite = stored[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP];
        const referenceTimestamp = Number(lastSubmission || firstStorageWrite || Date.now());
        if (Date.now() - referenceTimestamp <= LEETCODE_STALENESS_WINDOW_MS) {
            return '';
        }

        return 'LeetCode detection may be broken. Try a different source.';
    }

    async function persistChallenge(force) {
        const stored = await getStoredState();
        if (stored[STORAGE_KEYS.CURRENT_CHALLENGE] && !force) {
            return stored[STORAGE_KEYS.CURRENT_CHALLENGE];
        }

        const recentSlugs = normalizeRecentChallengeSlugs(stored[STORAGE_KEYS.RECENT_CHALLENGE_SLUGS]);
        const challenge = await leetcodeProvider.getChallenge({ recentSlugs });
        const nextRecentSlugs = [
            {
                source: challenge.source,
                slug: challenge.slug,
                timestamp: Date.now(),
            },
            ...recentSlugs.filter((entry) => {
                return entry.source !== challenge.source || entry.slug !== challenge.slug;
            }),
        ].slice(0, RECENT_CHALLENGE_WINDOW);

        await setStorageValues({
            [STORAGE_KEYS.CURRENT_CHALLENGE]: challenge,
            [STORAGE_KEYS.CHALLENGE_STARTED_AT]: Date.now(),
            [STORAGE_KEYS.RECENT_CHALLENGE_SLUGS]: nextRecentSlugs,
            [STORAGE_KEYS.UI_MESSAGE]: '',
        });

        return challenge;
    }

    async function clearChallenge(message) {
        const updates = {};
        if (message) {
            updates[STORAGE_KEYS.UI_MESSAGE] = message;
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }

        await removeStorageKeys([
            STORAGE_KEYS.CURRENT_CHALLENGE,
            STORAGE_KEYS.CHALLENGE_STARTED_AT,
        ]);
    }

    async function startSession(challenge) {
        const now = Date.now();
        const durationMs = getValidSessionDurationMs(await getStorageValue(STORAGE_KEYS.SESSION_DURATION_MS_PREF));
        await setStorageValues({
            [STORAGE_KEYS.LAST_SOLVED_TIME]: now,
            [STORAGE_KEYS.SESSION_EXPIRES_AT]: now + durationMs,
        });
    }

    async function getDashboardState() {
        await ensureInstallState();
        const stored = await getStoredState();

        return {
            installId: stored[STORAGE_KEYS.INSTALL_ID] || null,
            hasActiveSession: await hasActiveSession(),
            session: await getSessionInfo(),
            currentChallenge: stored[STORAGE_KEYS.CURRENT_CHALLENGE] || null,
            enabledTargetIds: stored[STORAGE_KEYS.ENABLED_TARGET_IDS] || getDefaultEnabledTargetIds(),
            sessionDurationMinutes: getSessionDurationMinutes(
                stored[STORAGE_KEYS.SESSION_DURATION_MS_PREF] || SESSION_DURATION_MINUTES * 60 * 1000,
            ),
            isPaused: Boolean(stored[STORAGE_KEYS.IS_PAUSED]),
            supportedTargets: CHATBOT_TARGETS,
            uiMessage: stored[STORAGE_KEYS.UI_MESSAGE] || '',
            leetcodeDetectionWarning: getLeetCodeDetectionWarning(stored),
        };
    }

    async function saveSettings(payload) {
        const updates = {};

        if (Array.isArray(payload?.enabledTargetIds)) {
            const allowedTargetIds = new Set(CHATBOT_TARGETS.map((target) => target.id));
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = payload.enabledTargetIds.filter((targetId) => allowedTargetIds.has(targetId));
        }

        if (typeof payload?.isPaused === 'boolean') {
            updates[STORAGE_KEYS.IS_PAUSED] = payload.isPaused;
        }

        if (SESSION_DURATION_MS_OPTIONS.includes(payload?.sessionDurationMsPref)) {
            updates[STORAGE_KEYS.SESSION_DURATION_MS_PREF] = payload.sessionDurationMsPref;
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }

        return getDashboardState();
    }

    async function grantAccess(source, slug) {
        const stored = await getStoredState();
        const currentChallenge = stored[STORAGE_KEYS.CURRENT_CHALLENGE];

        if (!currentChallenge || currentChallenge.source !== source || currentChallenge.slug !== slug) {
            const expectedSlug = currentChallenge?.slug || '';
            const expectedSource = currentChallenge?.source_label || currentChallenge?.source || source;
            await setStorageValues({
                [STORAGE_KEYS.UI_MESSAGE]: expectedSlug
                    ? `Wrong problem - solve ${expectedSlug} from ${expectedSource}.`
                    : 'Wrong problem - no active challenge is waiting for verification.',
            });

            return {
                success: false,
                error: 'WRONG_PROBLEM',
                expectedSlug,
                expectedSource,
            };
        }

        await startSession(currentChallenge);
        await setStorageValues({
            [STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP]: Date.now(),
        });
        await clearChallenge('Accepted on LeetCode. Dorso is standing down for the selected session duration.');

        return {
            success: true,
            challenge: currentChallenge,
            state: await getDashboardState(),
        };
    }

    browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
        Promise.resolve((async () => {
            switch (message.action) {
            case MESSAGE_ACTIONS.REQUEST_STATE:
                return { success: true, state: await getDashboardState() };
            case MESSAGE_ACTIONS.START_CHALLENGE:
                await persistChallenge(Boolean(message.force));
                return { success: true, state: await getDashboardState() };
            case MESSAGE_ACTIONS.SAVE_SETTINGS:
                return { success: true, state: await saveSettings(message.payload) };
            case MESSAGE_ACTIONS.SET_PAUSED:
                return { success: true, state: await saveSettings({ isPaused: Boolean(message.isPaused) }) };
            case MESSAGE_ACTIONS.SUBMISSION_RESULT:
                if (message.success && message.source === 'leetcode' && message.slug) {
                    return grantAccess('leetcode', message.slug);
                }
                return { success: false };
            case MESSAGE_ACTIONS.CLEAR_UI_MESSAGE:
                await setStorageValues({ [STORAGE_KEYS.UI_MESSAGE]: '' });
                return { success: true, state: await getDashboardState() };
            default:
                return { success: false, error: 'Unknown action.' };
            }
        })())
            .then((result) => sendResponse(result || {}))
            .catch((error) => {
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown extension error.',
                });
            });
        return true;
    });

    browserApi.runtime.onInstalled.addListener(() => {
        ensureInstallState().catch(() => {});
    });

    browserApi.runtime.onStartup?.addListener(() => {
        ensureInstallState().catch(() => {});
    });
})();
