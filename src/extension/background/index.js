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
    getChatbotTargetByUrl,
    getDefaultEnabledTargetIds,
} from '../../shared/core/constants.js';
import {
    DEFAULT_AI_FAST_STATE,
    createAiFastCalendar,
    createAiFastState,
    normalizeAiFastState,
    recordAiFastSolve,
} from '../../shared/core/ai-fast.js';
import {
    DEFAULT_CLI_STATUS_EXPORT_PATH,
    createCliStatusSnapshot,
    normalizeCliStatusExportPath,
} from '../../shared/core/cli-status.js';
import {
    getEmergencyBypassState,
    normalizeEmergencyBypassLimit,
} from '../../shared/core/emergency-bypass.js';
import {
    getTargetOrigin,
    normalizePerTargetRules,
} from '../../shared/core/target-rules.js';
import {
    createStreakState,
    normalizeStreakState,
    recordSolve,
} from '../../shared/core/streak.js';
import drillsProvider from '../lib/providers/drills-provider.js';
import eulerProvider from '../lib/providers/euler-provider.js';
import leetcodeProvider from '../lib/providers/leetcode-provider.js';
import mcqProvider from '../lib/providers/mcq-provider.js';

(function backgroundWorker() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const RECENT_CHALLENGE_WINDOW = 5;
    const LEETCODE_STALENESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const CLI_STATUS_EXPORT_ALARM = 'dorso-cli-status-export';
    const providers = {
        mcq: mcqProvider,
        drills: drillsProvider,
        leetcode: leetcodeProvider,
        euler: eulerProvider,
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

    async function downloadUrl(options) {
        if (!browserApi.downloads?.download) {
            throw new Error('Downloads API unavailable.');
        }

        if (globalThis.browser?.downloads?.download) {
            return globalThis.browser.downloads.download(options);
        }

        return callbackToPromise((done) => browserApi.downloads.download(options, done));
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

    function getAllowedTargetRules(value = {}) {
        return normalizePerTargetRules(value, {
            targets: CHATBOT_TARGETS,
            availableSources: Object.keys(providers),
        });
    }

    function getChallengeSourcesForRule(rule, enabledSources) {
        return rule?.sourcesOverride?.length
            ? getAllowedEnabledSources(rule.sourcesOverride)
            : getAllowedEnabledSources(enabledSources);
    }

    function getChallengeDifficultyForRule(rule, targetUrl) {
        return rule?.difficultyOverride && rule.difficultyOverride !== 'default'
            ? rule.difficultyOverride
            : getChatbotDifficultyByUrl(targetUrl);
    }

    function getChallengeProfile(stored, targetUrl) {
        const perTargetRules = getAllowedTargetRules(stored[STORAGE_KEYS.PER_TARGET_RULES]);
        const target = getChatbotTargetByUrl(targetUrl);
        const targetOrigin = target ? getTargetOrigin(target) : '';
        const rule = targetOrigin ? perTargetRules[targetOrigin] : null;
        const enabledSources = getChallengeSourcesForRule(rule, stored[STORAGE_KEYS.ENABLED_SOURCES]);
        const difficulty = getChallengeDifficultyForRule(rule, targetUrl);
        return {
            targetOrigin,
            ruleSignature: JSON.stringify({
                targetOrigin,
                enabledSources,
                difficulty,
            }),
            enabledSources,
            difficulty,
        };
    }

    function syncCliStatusExportAlarm(enabled) {
        if (!browserApi.alarms?.create) {
            return;
        }

        if (enabled) {
            browserApi.alarms.create(CLI_STATUS_EXPORT_ALARM, { periodInMinutes: 1 });
            return;
        }

        browserApi.alarms.clear?.(CLI_STATUS_EXPORT_ALARM);
    }

    async function ensureInstallStateInner() {
        const stored = await getStorageValues([
            STORAGE_KEYS.INSTALL_ID,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.ENABLED_SOURCES,
            STORAGE_KEYS.PER_TARGET_RULES,
            STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED,
            STORAGE_KEYS.CLI_STATUS_EXPORT_PATH,
            STORAGE_KEYS.CLI_STATUS_LAST_EXPORTED_AT,
            STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR,
            STORAGE_KEYS.AI_FAST,
            STORAGE_KEYS.LEADERBOARD_REPO_URL,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK,
            STORAGE_KEYS.BYPASS_WEEK_START,
            STORAGE_KEYS.BYPASSES_USED_THIS_WEEK,
            STORAGE_KEYS.STREAK_STATE,
            STORAGE_KEYS.IS_PAUSED,
            STORAGE_KEYS.ONBOARDING_COMPLETED,
        ]);
        const updates = {};
        const hasExistingInstallState = Boolean(
            stored[STORAGE_KEYS.INSTALL_ID] || stored[STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP],
        );
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

        if (!stored[STORAGE_KEYS.PER_TARGET_RULES] || typeof stored[STORAGE_KEYS.PER_TARGET_RULES] !== 'object') {
            updates[STORAGE_KEYS.PER_TARGET_RULES] = getAllowedTargetRules();
        }

        if (typeof stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED] !== 'boolean') {
            updates[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED] = false;
        }

        if (typeof stored[STORAGE_KEYS.CLI_STATUS_EXPORT_PATH] !== 'string') {
            updates[STORAGE_KEYS.CLI_STATUS_EXPORT_PATH] = DEFAULT_CLI_STATUS_EXPORT_PATH;
        }

        if (typeof stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR] !== 'string') {
            updates[STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR] = '';
        }

        if (!stored[STORAGE_KEYS.AI_FAST] || typeof stored[STORAGE_KEYS.AI_FAST] !== 'object') {
            updates[STORAGE_KEYS.AI_FAST] = DEFAULT_AI_FAST_STATE;
        }

        if (typeof stored[STORAGE_KEYS.LEADERBOARD_REPO_URL] !== 'string') {
            updates[STORAGE_KEYS.LEADERBOARD_REPO_URL] = '';
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

        if (typeof stored[STORAGE_KEYS.ONBOARDING_COMPLETED] !== 'boolean') {
            updates[STORAGE_KEYS.ONBOARDING_COMPLETED] = hasExistingInstallState;
        }

        if (Object.keys(updates).length > 0) {
            await setStorageValues(updates);
        }

        syncCliStatusExportAlarm(Boolean(
            Object.prototype.hasOwnProperty.call(updates, STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED)
                ? updates[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED]
                : stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED],
        ));
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
            STORAGE_KEYS.LAST_SOLVE_RECEIPT,
            STORAGE_KEYS.RECENT_CHALLENGE_SLUGS,
            STORAGE_KEYS.STREAK_STATE,
            STORAGE_KEYS.ENABLED_TARGET_IDS,
            STORAGE_KEYS.ENABLED_SOURCES,
            STORAGE_KEYS.PER_TARGET_RULES,
            STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED,
            STORAGE_KEYS.CLI_STATUS_EXPORT_PATH,
            STORAGE_KEYS.CLI_STATUS_LAST_EXPORTED_AT,
            STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR,
            STORAGE_KEYS.AI_FAST,
            STORAGE_KEYS.LEADERBOARD_REPO_URL,
            STORAGE_KEYS.SESSION_DURATION_MS_PREF,
            STORAGE_KEYS.EMERGENCY_BYPASSES_PER_WEEK,
            STORAGE_KEYS.BYPASS_WEEK_START,
            STORAGE_KEYS.BYPASSES_USED_THIS_WEEK,
            STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP,
            STORAGE_KEYS.FIRST_STORAGE_WRITE_TIMESTAMP,
            STORAGE_KEYS.MESSAGE_FAILURE_COUNT,
            STORAGE_KEYS.IS_PAUSED,
            STORAGE_KEYS.ONBOARDING_COMPLETED,
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
        const challengeProfile = getChallengeProfile(stored, targetUrl);
        if (
            stored[STORAGE_KEYS.CURRENT_CHALLENGE]
            && !force
            && stored[STORAGE_KEYS.CURRENT_CHALLENGE].targetOrigin === challengeProfile.targetOrigin
            && stored[STORAGE_KEYS.CURRENT_CHALLENGE].ruleSignature === challengeProfile.ruleSignature
        ) {
            return stored[STORAGE_KEYS.CURRENT_CHALLENGE];
        }

        const recentSlugs = normalizeRecentChallengeSlugs(stored[STORAGE_KEYS.RECENT_CHALLENGE_SLUGS]);
        const provider = providers[challengeProfile.enabledSources[Math.floor(Math.random() * challengeProfile.enabledSources.length)]];
        const challenge = await provider.getChallenge({
            recentSlugs,
            difficulty: challengeProfile.difficulty,
        });
        const storedChallenge = {
            ...challenge,
            targetOrigin: challengeProfile.targetOrigin,
            ruleSignature: challengeProfile.ruleSignature,
        };
        const nextRecentSlugs = [
            {
                source: storedChallenge.source,
                slug: storedChallenge.slug,
                timestamp: Date.now(),
            },
            ...recentSlugs.filter((entry) => {
                return entry.source !== storedChallenge.source || entry.slug !== storedChallenge.slug;
            }),
        ].slice(0, RECENT_CHALLENGE_WINDOW);

        await setStorageValues({
            [STORAGE_KEYS.CURRENT_CHALLENGE]: storedChallenge,
            [STORAGE_KEYS.CHALLENGE_STARTED_AT]: Date.now(),
            [STORAGE_KEYS.RECENT_CHALLENGE_SLUGS]: nextRecentSlugs,
            [STORAGE_KEYS.UI_MESSAGE]: '',
        });

        return storedChallenge;
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

    async function startSession(durationMs = null, now = Date.now()) {
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
        const aiFast = normalizeAiFastState(stored[STORAGE_KEYS.AI_FAST]);

        return {
            installId: stored[STORAGE_KEYS.INSTALL_ID] || null,
            hasActiveSession: await hasActiveSession(),
            session: await getSessionInfo(),
            currentChallenge: stored[STORAGE_KEYS.CURRENT_CHALLENGE] || null,
            solveReceipt: stored[STORAGE_KEYS.LAST_SOLVE_RECEIPT] || null,
            enabledTargetIds: stored[STORAGE_KEYS.ENABLED_TARGET_IDS] || getDefaultEnabledTargetIds(),
            enabledSources: getAllowedEnabledSources(stored[STORAGE_KEYS.ENABLED_SOURCES]),
            perTargetRules: getAllowedTargetRules(stored[STORAGE_KEYS.PER_TARGET_RULES]),
            cliStatusExportEnabled: Boolean(stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED]),
            cliStatusExportPath: normalizeCliStatusExportPath(stored[STORAGE_KEYS.CLI_STATUS_EXPORT_PATH]),
            cliStatusLastExportedAt: stored[STORAGE_KEYS.CLI_STATUS_LAST_EXPORTED_AT] || null,
            cliStatusExportError: stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR] || '',
            aiFast,
            leaderboardRepoUrl: stored[STORAGE_KEYS.LEADERBOARD_REPO_URL] || '',
            sessionDurationMinutes: getSessionDurationMinutes(
                stored[STORAGE_KEYS.SESSION_DURATION_MS_PREF] || SESSION_DURATION_MINUTES * 60 * 1000,
            ),
            emergencyBypassesPerWeek: emergencyBypassState.limit,
            bypassesThisWeek: emergencyBypassState.used,
            emergencyBypassesRemaining: aiFast.active ? 0 : emergencyBypassState.remaining,
            bypassWeekStart: emergencyBypassState.weekStart,
            currentRun: streakState.currentRun,
            longestRun: streakState.longestRun,
            graceDaysRemaining: streakState.graceDaysRemaining,
            isPaused: Boolean(stored[STORAGE_KEYS.IS_PAUSED]),
            hasCompletedOnboarding: Boolean(stored[STORAGE_KEYS.ONBOARDING_COMPLETED]),
            supportedTargets: CHATBOT_TARGETS,
            supportedSources: getSupportedSources(),
            uiMessage: stored[STORAGE_KEYS.UI_MESSAGE] || '',
            messageFailureCount: Number(stored[STORAGE_KEYS.MESSAGE_FAILURE_COUNT] || 0),
            leetcodeDetectionWarning: getLeetCodeDetectionWarning(stored),
        };
    }

    async function saveSettings(payload) {
        const updates = {};
        let cliStatusSettingsChanged = false;

        if (Array.isArray(payload?.enabledTargetIds)) {
            const allowedTargetIds = new Set(CHATBOT_TARGETS.map((target) => target.id));
            updates[STORAGE_KEYS.ENABLED_TARGET_IDS] = payload.enabledTargetIds.filter((targetId) => allowedTargetIds.has(targetId));
        }

        if (Array.isArray(payload?.enabledSources)) {
            updates[STORAGE_KEYS.ENABLED_SOURCES] = getAllowedEnabledSources(payload.enabledSources);
        }

        if (payload?.perTargetRules && typeof payload.perTargetRules === 'object') {
            updates[STORAGE_KEYS.PER_TARGET_RULES] = getAllowedTargetRules(payload.perTargetRules);
        }

        if (typeof payload?.cliStatusExportEnabled === 'boolean') {
            updates[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED] = payload.cliStatusExportEnabled;
            cliStatusSettingsChanged = true;
        }

        if (Object.prototype.hasOwnProperty.call(payload || {}, 'cliStatusExportPath')) {
            updates[STORAGE_KEYS.CLI_STATUS_EXPORT_PATH] = normalizeCliStatusExportPath(payload.cliStatusExportPath);
            cliStatusSettingsChanged = true;
        }

        if (typeof payload?.isPaused === 'boolean') {
            const aiFast = normalizeAiFastState(await getStorageValue(STORAGE_KEYS.AI_FAST));
            if (aiFast.active && payload.isPaused) {
                updates[STORAGE_KEYS.IS_PAUSED] = false;
                updates[STORAGE_KEYS.UI_MESSAGE] = 'AI fast is active. Pause is unavailable.';
            } else {
                updates[STORAGE_KEYS.IS_PAUSED] = payload.isPaused;
            }
        }

        if (typeof payload?.hasCompletedOnboarding === 'boolean') {
            updates[STORAGE_KEYS.ONBOARDING_COMPLETED] = payload.hasCompletedOnboarding;
        }

        if (Object.prototype.hasOwnProperty.call(payload || {}, 'leaderboardRepoUrl')) {
            updates[STORAGE_KEYS.LEADERBOARD_REPO_URL] = String(payload.leaderboardRepoUrl || '').trim();
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

        if (cliStatusSettingsChanged) {
            const isEnabled = Object.prototype.hasOwnProperty.call(updates, STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED)
                ? updates[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED]
                : Boolean(await getStorageValue(STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED));
            syncCliStatusExportAlarm(isEnabled);
            if (isEnabled) {
                await exportCliStatus({ force: true });
            }
        }

        return getDashboardState();
    }

    async function exportCliStatus({ force = false } = {}) {
        try {
            await ensureInstallState();
            const stored = await getStorageValues([
                STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED,
                STORAGE_KEYS.CLI_STATUS_EXPORT_PATH,
            ]);
            const enabled = Boolean(stored[STORAGE_KEYS.CLI_STATUS_EXPORT_ENABLED]);
            if (!enabled && !force) {
                return { success: true, skipped: true };
            }

            const state = await getDashboardState();
            const exportPath = normalizeCliStatusExportPath(stored[STORAGE_KEYS.CLI_STATUS_EXPORT_PATH]);
            const snapshot = createCliStatusSnapshot(state, {
                installIdHash: await sha256Hex(String(state.installId || 'unknown-install')),
            });
            const downloadId = await downloadUrl({
                url: `data:application/json;charset=utf-8,${encodeURIComponent(`${JSON.stringify(snapshot, null, 2)}\n`)}`,
                filename: exportPath,
                conflictAction: 'overwrite',
                saveAs: false,
            });

            await setStorageValues({
                [STORAGE_KEYS.CLI_STATUS_EXPORT_PATH]: exportPath,
                [STORAGE_KEYS.CLI_STATUS_LAST_EXPORTED_AT]: snapshot.exportedAt,
                [STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR]: '',
            });

            return {
                success: true,
                downloadId,
                path: exportPath,
                status: snapshot,
            };
        } catch (error) {
            const message = error.message || 'CLI status export failed.';
            await setStorageValues({ [STORAGE_KEYS.CLI_STATUS_EXPORT_ERROR]: message });
            return {
                success: false,
                error: message,
            };
        }
    }

    async function startAiFast(durationHours) {
        await ensureInstallState();
        await setStorageValues({
            [STORAGE_KEYS.AI_FAST]: createAiFastState(durationHours),
            [STORAGE_KEYS.IS_PAUSED]: false,
            [STORAGE_KEYS.UI_MESSAGE]: 'AI fast started. Emergency bypass and pause are unavailable until it ends.',
        });
        return {
            success: true,
            state: await getDashboardState(),
        };
    }

    async function exportAiFastCalendar() {
        try {
            await ensureInstallState();
            const stored = await getStoredState();
            const aiFast = normalizeAiFastState(stored[STORAGE_KEYS.AI_FAST]);
            if (!aiFast.startedAt) {
                return {
                    success: false,
                    error: 'No AI fast has been started.',
                    state: await getDashboardState(),
                };
            }

            if (aiFast.active) {
                return {
                    success: false,
                    error: 'AI fast is still active.',
                    state: await getDashboardState(),
                };
            }

            const startedDate = new Date(aiFast.startedAt).toISOString().slice(0, 10);
            const ics = createAiFastCalendar(aiFast);
            const downloadId = await downloadUrl({
                url: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
                filename: `dorso/ai-fast-${startedDate}.ics`,
                conflictAction: 'overwrite',
                saveAs: false,
            });

            return {
                success: true,
                downloadId,
                state: await getDashboardState(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'AI fast calendar export failed.',
                state: await getDashboardState(),
            };
        }
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

        const solvedAt = Date.now();
        await startSession(null, solvedAt);
        const streakState = recordSolve(stored[STORAGE_KEYS.STREAK_STATE]);
        const updates = {
            [STORAGE_KEYS.STREAK_STATE]: streakState,
            [STORAGE_KEYS.AI_FAST]: recordAiFastSolve(stored[STORAGE_KEYS.AI_FAST], currentChallenge, solvedAt),
            [STORAGE_KEYS.LAST_SOLVE_RECEIPT]: {
                problemTitle: currentChallenge.title,
                sourceLabel: currentChallenge.source_label || currentChallenge.source,
                timeToSolveMs: Math.max(0, solvedAt - Number(stored[STORAGE_KEYS.CHALLENGE_STARTED_AT] || solvedAt)),
                solvedAt: new Date(solvedAt).toISOString(),
                currentRun: streakState.currentRun,
            },
        };
        if (currentChallenge.source === 'leetcode') {
            updates[STORAGE_KEYS.LAST_LC_SUBMISSION_TIMESTAMP] = solvedAt;
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
        const aiFast = normalizeAiFastState(stored[STORAGE_KEYS.AI_FAST]);
        if (aiFast.active) {
            await setStorageValues({
                [STORAGE_KEYS.UI_MESSAGE]: 'AI fast is active. Emergency bypass is unavailable.',
            });
            return {
                success: false,
                error: 'AI_FAST_ACTIVE',
                state: await getDashboardState(),
            };
        }

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
            [STORAGE_KEYS.LAST_SOLVE_RECEIPT]: null,
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
            case MESSAGE_ACTIONS.EXPORT_CLI_STATUS: {
                const result = await exportCliStatus({ force: true });
                return {
                    ...result,
                    state: await getDashboardState(),
                };
            }
            case MESSAGE_ACTIONS.START_AI_FAST:
                return startAiFast(message.durationHours);
            case MESSAGE_ACTIONS.EXPORT_AI_FAST_ICS:
                return exportAiFastCalendar();
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

    browserApi.alarms?.onAlarm?.addListener((alarm) => {
        if (alarm.name !== CLI_STATUS_EXPORT_ALARM) {
            return;
        }

        exportCliStatus({ force: false }).catch(() => {});
    });
})();
