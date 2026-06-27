import {
    CHATBOT_TARGETS,
    LOCAL_CHALLENGES,
    MESSAGE_ACTIONS,
    SESSION_DURATION_MS,
    SOURCE_LABELS,
    STORAGE_KEYS,
    getDefaultEnabledTargetIds,
} from '../../shared/core/constants.js';

(function backgroundWorker() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const RECENT_CHALLENGE_WINDOW = 5;

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

    function createInstallId() {
        if (globalThis.crypto?.randomUUID) {
            return globalThis.crypto.randomUUID();
        }

        return `dorso-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function normalizeChallenge(challenge) {
        return {
            source: 'leetcode',
            source_label: SOURCE_LABELS.leetcode,
            challenge_id: challenge.slug,
            title: challenge.title,
            slug: challenge.slug,
            url: `https://leetcode.com/problems/${challenge.slug}/description/`,
            difficulty: challenge.difficulty,
            topic_tags: challenge.topic_tags,
            guidance: 'Open the official LeetCode page to read the full prompt and submit your solution there.',
            selection_mode: 'curated_local',
            supports_verification: true,
        };
    }

    async function ensureInstallState() {
        const stored = await getStorageValues([
            STORAGE_KEYS.INSTALL_ID,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.IS_PAUSED,
        ]);
        const updates = {};

        if (!stored[STORAGE_KEYS.INSTALL_ID]) {
            updates[STORAGE_KEYS.INSTALL_ID] = createInstallId();
        }

        if (!Array.isArray(stored[STORAGE_KEYS.ENABLED_TARGET_IDS])) {
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = getDefaultEnabledTargetIds();
        }

        if (typeof stored[STORAGE_KEYS.IS_PAUSED] !== 'boolean') {
            updates[STORAGE_KEYS.IS_PAUSED] = false;
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }
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
            STORAGE_KEYS.IS_PAUSED,
            STORAGE_KEYS.UI_MESSAGE,
        ]);
    }

    async function persistChallenge(force) {
        const stored = await getStoredState();
        if (stored[STORAGE_KEYS.CURRENT_CHALLENGE] && !force) {
            return stored[STORAGE_KEYS.CURRENT_CHALLENGE];
        }

        const recentSlugs = stored[STORAGE_KEYS.RECENT_CHALLENGE_SLUGS] || [];
        const candidatePool = LOCAL_CHALLENGES.filter((challenge) => !recentSlugs.includes(challenge.slug));
        const pool = candidatePool.length ? candidatePool : LOCAL_CHALLENGES;
        const challenge = normalizeChallenge(pool[Math.floor(Math.random() * pool.length)]);
        const nextRecentSlugs = [
            challenge.slug,
            ...recentSlugs.filter((slug) => slug !== challenge.slug),
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
        await setStorageValues({
            [STORAGE_KEYS.LAST_SOLVED_TIME]: now,
            [STORAGE_KEYS.SESSION_EXPIRES_AT]: now + SESSION_DURATION_MS,
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
            isPaused: Boolean(stored[STORAGE_KEYS.IS_PAUSED]),
            supportedTargets: CHATBOT_TARGETS,
            uiMessage: stored[STORAGE_KEYS.UI_MESSAGE] || '',
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
        await clearChallenge('Accepted on LeetCode. Dorso is standing down for the next fifteen minutes.');

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
