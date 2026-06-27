import {
    CHALLENGE_SOURCES,
    CHATBOT_TARGETS,
    DEFAULT_ENABLED_SOURCES,
    INSTALL_ID_PREFIX,
    MESSAGE_ACTIONS,
    SESSION_DURATION_MS,
    SESSION_DURATION_MS_OPTIONS,
    SESSION_DURATION_MINUTES,
    STORAGE_KEYS,
    getChatbotDifficultyByUrl,
    getDefaultEnabledTargetIds,
} from '../../shared/core/constants.js';
import {
    getEmergencyBypassState,
    normalizeEmergencyBypassLimit,
} from '../../shared/core/emergency-bypass.js';
import {
    createStreakState,
    normalizeStreakState,
    recordSolve,
} from '../../shared/core/streak.js';
import drillsProvider from '../lib/providers/drills-provider.js';
import leetcodeProvider from '../lib/providers/leetcode-provider.js';
import mcqProvider from '../lib/providers/mcq-provider.js';

(function backgroundWorker() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const RECENT_CHALLENGE_WINDOW = 5;
    const LEETCODE_STALENESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const providers = {
        mcq: mcqProvider,
        drills: drillsProvider,
        leetcode: leetcodeProvider,
    };
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

    function getSupportedSources() {
        return CHALLENGE_SOURCES.map((source) => ({
            ...source,
            isAvailable: Boolean(providers[source.id]),
        }));
    }

    function getAllowedEnabledSources(value = DEFAULT_ENABLED_SOURCES) {
        const requestedSources = Array.isArray(value) ? value : DEFAULT_ENABLED_SOURCES;
        const enabledSources = requestedSources.filter((sourceId) => providers[sourceId]);
        return enabledSources.length
            ? [...new Set(enabledSources)]
            : DEFAULT_ENABLED_SOURCES.filter((sourceId) => providers[sourceId]);
    }

    async function ensureInstallStateInner() {
        const stored = await getStorageValues([
            STORAGE_KEYS.INSTALL_ID,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.ENABLED_SOURCES,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK,
            STORAGE_KEYS.BYPASS_WEEK_START,
            STORAGE_KEYS.BYPASSES_USED_THIS_WEEK,
            STORAGE_KEYS.STREAK_STATE,
            STORAGE_KEYS.IS_PAUSED,
        ]);
        const updates = {};
        const emergencyBypassState = getEmergencyBypassState({
            limit: stored[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK],
            weekStart: stored[STORAGE_KEYS.BYPASS_WEEK_START],
            used: stored[STORAGE_KEYS.BYPASSES_USED_THIS_WEEK],
        });

        if (!stored[STORAGE_KEYS.INSTALL_ID]) {
            const firstStorageWriteTimestamp = stored[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP] || Date.now();
            updates[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP] = firstStorageWriteTimestamp;
            updates[STORAGE_KEYS.INSTALL_ID] = await createInstallId(firstStorageWriteTimestamp);
        }

        if (!Array.isArray(stored[STORAGE_KEYS.ENABLED_TARGET_IDS])) {
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = getDefaultEnabledTargetIds();
        }

        if (!Array.isArray(stored[STORAGE_KEYS.ENABLED_SOURCES])) {
            updates[STORAGE_KEYS.ENABLED_SOURCES] = getAllowedEnabledSources();
        }

        if (!SESSION_DURATION_MS_OPTIONS.includes(stored[STORAGE_KEYS.SESSION_DURATION_MS_PREF])) {
            updates[STORAGE_KEYS.SESSION_DURATION_MS_PREF] = SESSION_DURATION_MS;
        }

        if (stored[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK] !== emergencyBypassState.limit) {
            updates[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK] = emergencyBypassState.limit;
        }

        if (stored[STORAGE_KEYS.BYPASS_WEEK_START] !== emergencyBypassState.weekStart) {
            updates[STORAGE_KEYS.BYPASS_WEEK_START] = emergencyBypassState.weekStart;
        }

        if (stored[STORAGE_KEYS.BYPASSES_USED_THIS_WEEK] !== emergencyBypassState.used) {
            updates[STORAGE_KEYS.BYPASSES_USED_THIS_WEEK] = emergencyBypassState.used;
        }

        if (!stored[STORAGE_KEYS.STREAK_STATE]) {
            updates[STORAGE_KEYS.STREAK_STATE] = createStreakState();
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
            STORAGE_KEYS.STREAK_STATE,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.ENABLED_SOURCES,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK,
            STORAGE_KEYS.BYPASS_WEEK_START,
            STORAGE_KEYS.BYPASSES_USED_THIS_WEEK,
            STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.MESSAGE_FAILURE_COUNT,
            STORAGE_KEYS.IS_PAUSED,
            STORAGE_KEYS.UI_MESSAGE,
        ]);
    }

    function getLeetCodeDetectionWarning(stored) {
        if (!getAllowedEnabledSources(stored[STORAGE_KEYS.ENABLED_SOURCES]).includes('leetcode')) {
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

    async function persistChallenge(force, targetUrl) {
        const stored = await getStoredState();
        if (stored[STORAGE_KEYS.CURRENT_CHALLENGE] && !force) {
            return stored[STORAGE_KEYS.CURRENT_CHALLENGE];
        }

        const recentSlugs = normalizeRecentChallengeSlugs(stored[STORAGE_KEYS.RECENT_CHALLENGE_SLUGS]);
        const enabledSources = getAllowedEnabledSources(stored[STORAGE_KEYS.ENABLED_SOURCES]);
        const provider = providers[enabledSources[Math.floor(Math.random() * enabledSources.length)]];
        const challenge = await provider.getChallenge({
            recentSlugs,
            difficulty: getChatbotDifficultyByUrl(targetUrl),
        });
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

    async function startSession(durationMs = null) {
        const now = Date.now();
        const sessionDurationMs = durationMs || getValidSessionDurationMs(await getStorageValue(STORAGE_KEYS.SESSION_DURATION_MS_PREF));
        await setStorageValues({
            [STORAGE_KEYS.LAST_SOLVED_TIME]: now,
            [STORAGE_KEYS.SESSION_EXPIRES_AT]: now + sessionDurationMs,
        });
    }

    async function getDashboardState() {
        await ensureInstallState();
        const stored = await getStoredState();
        const emergencyBypassState = getEmergencyBypassState({
            limit: stored[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK],
            weekStart: stored[STORAGE_KEYS.BYPASS_WEEK_START],
            used: stored[STORAGE_KEYS.BYPASSES_USED_THIS_WEEK],
        });
        const streakState = normalizeStreakState(stored[STORAGE_KEYS.STREAK_STATE]);

        return {
            installId: stored[STORAGE_KEYS.INSTALL_ID] || null,
            hasActiveSession: await hasActiveSession(),
            session: await getSessionInfo(),
            currentChallenge: stored[STORAGE_KEYS.CURRENT_CHALLENGE] || null,
            enabledTargetIds: stored[STORAGE_KEYS.ENABLED_TARGET_IDS] || getDefaultEnabledTargetIds(),
            enabledSources: getAllowedEnabledSources(stored[STORAGE_KEYS.ENABLED_SOURCES]),
            sessionDurationMinutes: getSessionDurationMinutes(
                stored[STORAGE_KEYS.SESSION_DURATION_MS_PREF] || SESSION_DURATION_MINUTES * 60 * 1000,
            ),
            emergencyBypassesPerWeek: emergencyBypassState.limit,
            bypassesThisWeek: emergencyBypassState.used,
            emergencyBypassesRemaining: emergencyBypassState.remaining,
            bypassWeekStart: emergencyBypassState.weekStart,
            currentRun: streakState.currentRun,
            longestRun: streakState.longestRun,
            graceDaysRemaining: streakState.graceDaysRemaining,
            isPaused: Boolean(stored[STORAGE_KEYS.IS_PAUSED]),
            supportedTargets: CHATBOT_TARGETS,
            supportedSources: getSupportedSources(),
            uiMessage: stored[STORAGE_KEYS.UI_MESSAGE] || '',
            messageFailureCount: Number(stored[STORAGE_KEYS.MESSAGE_FAILURE_COUNT] || 0),
            leetcodeDetectionWarning: getLeetCodeDetectionWarning(stored),
        };
    }

    async function saveSettings(payload) {
        const updates = {};

        if (Array.isArray(payload?.enabledTargetIds)) {
            const allowedTargetIds = new Set(CHATBOT_TARGETS.map((target) => target.id));
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = payload.enabledTargetIds.filter((targetId) => allowedTargetIds.has(targetId));
        }

        if (Array.isArray(payload?.enabledSources)) {
            updates[STORAGE_KEYS.ENABLED_SOURCES] = getAllowedEnabledSources(payload.enabledSources);
        }

        if (typeof payload?.isPaused === 'boolean') {
            updates[STORAGE_KEYS.IS_PAUSED] = payload.isPaused;
        }

        if (SESSION_DURATION_MS_OPTIONS.includes(payload?.sessionDurationMsPref)) {
            updates[STORAGE_KEYS.SESSION_DURATION_MS_PREF] = payload.sessionDurationMsPref;
        }

        if (Object.prototype.hasOwnProperty.call(payload || {}, 'emergencyBypassesPerWeek')) {
            updates[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK] = normalizeEmergencyBypassLimit(payload.emergencyBypassesPerWeek);
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }

        return getDashboardState();
    }

    async function grantAccess(message) {
        const stored = await getStoredState();
        const currentChallenge = stored[STORAGE_KEYS.CURRENT_CHALLENGE];
        const provider = currentChallenge ? providers[currentChallenge.source] : null;

        if (!currentChallenge || currentChallenge.source !== message.source || currentChallenge.slug !== message.slug || !provider) {
            const expectedSlug = currentChallenge?.slug || '';
            const expectedSource = currentChallenge?.source_label || currentChallenge?.source || message.source;
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

        const verification = await provider.verify(
            currentChallenge,
            currentChallenge.source === 'leetcode' ? message : message.submission,
        );

        if (!verification.ok) {
            await setStorageValues({
                [STORAGE_KEYS.UI_MESSAGE]: verification.message || 'Challenge answer did not verify.',
            });

            return {
                success: false,
                error: 'VERIFY_FAILED',
                ...verification,
                state: await getDashboardState(),
            };
        }

        await startSession();
        const streakState = recordSolve(stored[STORAGE_KEYS.STREAK_STATE]);
        const updates = {
            [STORAGE_KEYS.STREAK_STATE]: streakState,
        };
        if (currentChallenge.source === 'leetcode') {
            updates[STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP] = Date.now();
        }

        await setStorageValues(updates);
        await clearChallenge(`Accepted on ${currentChallenge.source_label || currentChallenge.source}. Dorso is standing down for the selected session duration.`);

        return {
            success: true,
            challenge: currentChallenge,
            state: await getDashboardState(),
        };
    }

    async function useEmergencyBypass() {
        await ensureInstallState();
        const stored = await getStoredState();
        const emergencyBypassState = getEmergencyBypassState({
            limit: stored[STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK],
            weekStart: stored[STORAGE_KEYS.BYPASS_WEEK_START],
            used: stored[STORAGE_KEYS.BYPASSES_USED_THIS_WEEK],
        });

        if (emergencyBypassState.remaining <= 0) {
            await setStorageValues({
                [STORAGE_KEYS.UI_MESSAGE]: 'No emergency bypasses remaining this week.',
            });
            return {
                success: false,
                error: 'NO_EMERGENCY_BYPASSES_REMAINING',
                state: await getDashboardState(),
            };
        }

        await startSession(SESSION_DURATION_MS);
        await setStorageValues({
            [STORAGE_KEYS.BYPASS_WEEK_START]: emergencyBypassState.weekStart,
            [STORAGE_KEYS.BYPASSES_USED_THIS_WEEK]: emergencyBypassState.used + 1,
            [STORAGE_KEYS.UI_MESSAGE]: `Emergency bypass used. ${emergencyBypassState.remaining - 1} remaining this week.`,
        });

        return {
            success: true,
            state: await getDashboardState(),
        };
    }

    browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
        Promise.resolve((async () => {
            switch (message.action) {
            case MESSAGE_ACTIONS.REQUEST_STATE:
                return { success: true, state: await getDashboardState() };
            case MESSAGE_ACTIONS.START_CHALLENGE:
                await persistChallenge(Boolean(message.force), message.targetUrl);
                return { success: true, state: await getDashboardState() };
            case MESSAGE_ACTIONS.SAVE_SETTINGS:
                return { success: true, state: await saveSettings(message.payload) };
            case MESSAGE_ACTIONS.SET_PAUSED:
                return { success: true, state: await saveSettings({ isPaused: Boolean(message.isPaused) }) };
            case MESSAGE_ACTIONS.EMERGENCY_BYPASS:
                return useEmergencyBypass();
            case MESSAGE_ACTIONS.SUBMISSION_RESULT:
                if (message.source && message.slug) {
                    return grantAccess(message);
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
