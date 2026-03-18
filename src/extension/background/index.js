import {
    CHATBOT_MAP,
    LLM_REGEX,
    MESSAGE_ACTIONS,
    STORAGE_KEYS,
} from '../../shared/core/constants.js';
import backendClient from '../../shared/api/backend-client.js';
import questionManager from '../../shared/core/question-manager.js';
import SessionManager from '../../shared/core/session-manager.js';
import logger from '../../shared/utils/logger.js';
import { createStorageAdapter } from '../lib/storage.js';
import {
    addAsyncMessageListener,
    createTab,
    getBrowserApi,
    getBrowserName,
    runtimeUrl,
    updateTab,
} from '../lib/browser-api.js';

const browserApi = getBrowserApi();
const storage = createStorageAdapter();
const sessionManager = new SessionManager(storage);

function getFriendlyChatbotName(url) {
    const parsedUrl = new URL(url);
    const match = Object.entries(CHATBOT_MAP).find(([needle]) => {
        return parsedUrl.hostname.includes(needle) || `${parsedUrl.hostname}${parsedUrl.pathname}`.includes(needle);
    });
    return match ? match[1] : parsedUrl.hostname;
}

async function ensureExtensionIdentity() {
    let extensionId = await storage.get(STORAGE_KEYS.EXTENSION_ID);

    if (!extensionId) {
        extensionId = browserApi.runtime.id;
        await storage.set(STORAGE_KEYS.EXTENSION_ID, extensionId);
    }

    try {
        await backendClient.registerUser(extensionId, getBrowserName());
    } catch (error) {
        logger.warn('Unable to register extension user', { error: error.message });
    }

    return extensionId;
}

async function getStoredState() {
    return storage.getMany([
        STORAGE_KEYS.CURRENT_CHALLENGE,
        STORAGE_KEYS.CHALLENGE_STARTED_AT,
        STORAGE_KEYS.CHALLENGE_SOURCE,
        STORAGE_KEYS.PENDING_REDIRECT_URL,
        STORAGE_KEYS.PENDING_TAB_ID,
        STORAGE_KEYS.USER_PREFERENCES,
        STORAGE_KEYS.USER_IDENTITIES,
        STORAGE_KEYS.USER_STATS,
        STORAGE_KEYS.PRACTICE_DECK,
        STORAGE_KEYS.UI_MESSAGE,
        STORAGE_KEYS.LAST_ACCESS_URL,
        STORAGE_KEYS.LAST_ACCESS_LOGGED_AT,
    ]);
}

async function persistChallenge(challenge, force = false) {
    const stored = await getStoredState();
    if (stored[STORAGE_KEYS.CURRENT_CHALLENGE] && !force) {
        return stored[STORAGE_KEYS.CURRENT_CHALLENGE];
    }

    const extensionId = await ensureExtensionIdentity();
    const nextChallenge = await questionManager.getRandomProblem(extensionId);

    await storage.setMany({
        [STORAGE_KEYS.CURRENT_CHALLENGE]: nextChallenge,
        [STORAGE_KEYS.CHALLENGE_SOURCE]: nextChallenge.source,
        [STORAGE_KEYS.CHALLENGE_STARTED_AT]: Date.now(),
        [STORAGE_KEYS.UI_MESSAGE]: '',
    });

    return nextChallenge;
}

async function restorePendingTab() {
    const stored = await getStoredState();
    const pendingUrl = stored[STORAGE_KEYS.PENDING_REDIRECT_URL];
    const pendingTabId = stored[STORAGE_KEYS.PENDING_TAB_ID];

    if (!pendingUrl) {
        return { restored: false };
    }

    try {
        if (typeof pendingTabId === 'number') {
            await updateTab(pendingTabId, { url: pendingUrl, active: true });
        } else {
            await createTab({ url: pendingUrl });
        }
    } catch (error) {
        logger.warn('Unable to update stored AI tab, opening a new one', {
            error: error.message,
        });
        await createTab({ url: pendingUrl });
    }

    await storage.remove(STORAGE_KEYS.PENDING_REDIRECT_URL);
    await storage.remove(STORAGE_KEYS.PENDING_TAB_ID);
    return { restored: true, url: pendingUrl };
}

async function maybeLogChatbotAccess(extensionId, url) {
    const stored = await getStoredState();
    const lastLoggedUrl = stored[STORAGE_KEYS.LAST_ACCESS_URL];
    const lastLoggedAt = stored[STORAGE_KEYS.LAST_ACCESS_LOGGED_AT] || 0;

    if (lastLoggedUrl === url && Date.now() - lastLoggedAt < 10_000) {
        return;
    }

    try {
        await backendClient.logAccess(
            extensionId,
            url,
            getFriendlyChatbotName(url),
        );
        await storage.setMany({
            [STORAGE_KEYS.LAST_ACCESS_URL]: url,
            [STORAGE_KEYS.LAST_ACCESS_LOGGED_AT]: Date.now(),
        });
    } catch (error) {
        logger.warn('Unable to log chatbot access', { error: error.message });
    }
}

async function grantAccess(source, message) {
    const extensionId = await ensureExtensionIdentity();
    const stored = await getStoredState();
    const currentChallenge = stored[STORAGE_KEYS.CURRENT_CHALLENGE];

    if (!currentChallenge || currentChallenge.source !== source) {
        return {
            success: false,
            error: 'No matching active challenge is waiting for verification.',
        };
    }

    const challengeStartedAt = stored[STORAGE_KEYS.CHALLENGE_STARTED_AT];
    const timeTaken = challengeStartedAt
        ? Math.max(1, Math.round((Date.now() - challengeStartedAt) / 1000))
        : null;

    await sessionManager.startSession(extensionId, {
        ...currentChallenge,
        timeTaken,
    });

    await storage.setMany({
        [STORAGE_KEYS.UI_MESSAGE]: message,
        [STORAGE_KEYS.LAST_SOLVED_TIME]: Date.now(),
    });
    await storage.remove(STORAGE_KEYS.CURRENT_CHALLENGE);
    await storage.remove(STORAGE_KEYS.CHALLENGE_STARTED_AT);
    await storage.remove(STORAGE_KEYS.CHALLENGE_SOURCE);

    const restoreResult = await restorePendingTab();
    return {
        success: true,
        restored: restoreResult.restored,
        challenge: currentChallenge,
    };
}

async function getDashboardState() {
    const extensionId = await ensureExtensionIdentity();
    const hasActiveSession = await sessionManager.hasActiveSession(extensionId);
    const session = await sessionManager.getSessionInfo();
    const stored = await getStoredState();

    let stats = stored[STORAGE_KEYS.USER_STATS] || null;
    let preferences = stored[STORAGE_KEYS.USER_PREFERENCES] || null;
    let identities = stored[STORAGE_KEYS.USER_IDENTITIES] || null;

    try {
        stats = await backendClient.getUserStats(extensionId);
        preferences = stats.preferences || await backendClient.getPreferences(extensionId);
        identities = stats.identities || await backendClient.getIdentities(extensionId);

        await storage.setMany({
            [STORAGE_KEYS.USER_STATS]: stats,
            [STORAGE_KEYS.USER_PREFERENCES]: preferences,
            [STORAGE_KEYS.USER_IDENTITIES]: identities,
        });
    } catch (error) {
        logger.warn('Unable to fetch backend dashboard state', {
            error: error.message,
        });
    }

    return {
        extensionId,
        browserName: getBrowserName(),
        hasActiveSession,
        session,
        currentChallenge: stored[STORAGE_KEYS.CURRENT_CHALLENGE] || null,
        pendingRedirectUrl: stored[STORAGE_KEYS.PENDING_REDIRECT_URL] || null,
        pendingTabId: stored[STORAGE_KEYS.PENDING_TAB_ID] ?? null,
        stats,
        preferences,
        identities,
        practiceDeck: stored[STORAGE_KEYS.PRACTICE_DECK] || [],
        uiMessage: stored[STORAGE_KEYS.UI_MESSAGE] || '',
    };
}

async function handleBlockedNavigation(details) {
    if (details.frameId !== 0 || details.tabId < 0) {
        return;
    }

    if (!LLM_REGEX.test(details.url)) {
        return;
    }

    if (details.url.startsWith(browserApi.runtime.getURL(''))) {
        return;
    }

    const extensionId = await ensureExtensionIdentity();
    const hasActiveSession = await sessionManager.hasActiveSession(extensionId);

    if (hasActiveSession) {
        await maybeLogChatbotAccess(extensionId, details.url);
        return;
    }

    await storage.setMany({
        [STORAGE_KEYS.PENDING_REDIRECT_URL]: details.url,
        [STORAGE_KEYS.PENDING_TAB_ID]: details.tabId,
    });

    try {
        await persistChallenge();
    } catch (error) {
        logger.error('Unable to start challenge before blocking chatbot', {
            error: error.message,
        });
        await storage.set(STORAGE_KEYS.UI_MESSAGE, 'Challenge fetch failed. Dorso is still blocking the tab.');
    }

    await updateTab(details.tabId, {
        url: runtimeUrl('ui/gate.html'),
    });
}

function bindNavigationGuard() {
    browserApi.webNavigation.onBeforeNavigate.addListener(
        (details) => {
            handleBlockedNavigation(details).catch((error) => {
                logger.error('Navigation guard failed', { error: error.message });
            });
        },
        {
            url: [{ urlMatches: LLM_REGEX.source }],
        },
    );
}

addAsyncMessageListener(async (message) => {
    switch (message.action) {
    case MESSAGE_ACTIONS.REQUEST_STATE:
    case MESSAGE_ACTIONS.REFRESH_STATE:
        return { success: true, state: await getDashboardState() };
    case MESSAGE_ACTIONS.START_CHALLENGE:
        await persistChallenge(Boolean(message.force));
        return { success: true, state: await getDashboardState() };
    case MESSAGE_ACTIONS.OPEN_CURRENT_CHALLENGE: {
        const challenge = await persistChallenge();
        await createTab({ url: challenge.url, active: true });
        return { success: true, challenge };
    }
    case MESSAGE_ACTIONS.RESTORE_PENDING_TAB:
        return restorePendingTab();
    case MESSAGE_ACTIONS.SAVE_PREFERENCES: {
        const extensionId = await ensureExtensionIdentity();
        const preferences = await backendClient.updatePreferences(extensionId, message.payload);
        await storage.set(STORAGE_KEYS.USER_PREFERENCES, preferences);
        return { success: true, preferences };
    }
    case MESSAGE_ACTIONS.SAVE_IDENTITIES: {
        const extensionId = await ensureExtensionIdentity();
        const identities = await backendClient.updateIdentities(extensionId, message.payload);
        await storage.set(STORAGE_KEYS.USER_IDENTITIES, identities);
        return { success: true, identities };
    }
    case MESSAGE_ACTIONS.SUBMISSION_RESULT:
        if (message.success && message.source === 'leetcode') {
            return grantAccess('leetcode', 'Access granted. Your AI ration has been restored for fifteen minutes.');
        }
        return { success: false };
    case MESSAGE_ACTIONS.UPDATE_UI_MESSAGE:
        await storage.set(STORAGE_KEYS.UI_MESSAGE, message.message || '');
        return { success: true };
    case MESSAGE_ACTIONS.LOG_CHATBOT_ACCESS: {
        const extensionId = await ensureExtensionIdentity();
        await maybeLogChatbotAccess(extensionId, message.url);
        return { success: true };
    }
    default:
        return { success: false, error: 'Unknown action.' };
    }
});

browserApi.runtime.onInstalled.addListener(() => {
    ensureExtensionIdentity().catch((error) => {
        logger.warn('Initial registration failed', { error: error.message });
    });
});

browserApi.runtime.onStartup?.addListener(() => {
    ensureExtensionIdentity().catch((error) => {
        logger.warn('Startup registration failed', { error: error.message });
    });
});

bindNavigationGuard();

