import { DEFAULT_SETTINGS } from './constants';
import { OAuthClientIds, OAuthTokenSet, WebExtSettings } from './types';
import { extensionBrowser } from './browser-api';
import { sanitizeCustomPrefixes } from './parser';
import { logError, logWarn } from './logger';

const SETTINGS_KEY = 'owl-webext-settings';
const TOKEN_KEY = 'owl-webext-token';
let warnedMissingStorage = false;

function getStorageArea(): any {
  const area = extensionBrowser.storage?.local;
  if (!area && !warnedMissingStorage) {
    warnedMissingStorage = true;
    logWarn('storage', 'local storage API is unavailable; settings will not persist');
  }
  return area;
}

function normalizeSettings(rawValue: unknown): WebExtSettings {
  const raw = (rawValue ?? {}) as Partial<WebExtSettings>;
  const rawClientIds = (raw.oauthClientIds ?? {}) as Partial<OAuthClientIds>;
  return {
    colorscheme:
      typeof raw.colorscheme === 'string' && raw.colorscheme.trim().length > 0
        ? raw.colorscheme
        : DEFAULT_SETTINGS.colorscheme,
    customPrefixes: sanitizeCustomPrefixes(
      Array.isArray(raw.customPrefixes) ? raw.customPrefixes.map(String) : []
    ),
    alwaysEnableOnGoogleEditors: Boolean(raw.alwaysEnableOnGoogleEditors),
    oauthClientIds: {
      chrome:
        typeof rawClientIds.chrome === 'string'
          ? rawClientIds.chrome
          : DEFAULT_SETTINGS.oauthClientIds.chrome,
      firefox:
        typeof rawClientIds.firefox === 'string'
          ? rawClientIds.firefox
          : DEFAULT_SETTINGS.oauthClientIds.firefox,
      safari:
        typeof rawClientIds.safari === 'string'
          ? rawClientIds.safari
          : DEFAULT_SETTINGS.oauthClientIds.safari,
    },
  };
}

function isTokenSet(value: unknown): value is OAuthTokenSet {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const token = value as OAuthTokenSet;
  return (
    typeof token.accessToken === 'string' &&
    typeof token.expiresAt === 'number' &&
    Array.isArray(token.scopes)
  );
}

export async function loadSettings(): Promise<WebExtSettings> {
  const storage = getStorageArea();
  if (!storage) {
    return DEFAULT_SETTINGS;
  }

  try {
    const result = await storage.get(SETTINGS_KEY);
    return normalizeSettings(result?.[SETTINGS_KEY]);
  } catch (error: unknown) {
    logError('storage', 'failed to load settings; using defaults', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: WebExtSettings): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
  } catch (error: unknown) {
    logError('storage', 'failed to save settings', error);
    throw error;
  }
}

export async function loadToken(): Promise<OAuthTokenSet | null> {
  const storage = getStorageArea();
  if (!storage) {
    return null;
  }

  try {
    const result = await storage.get(TOKEN_KEY);
    const token = result?.[TOKEN_KEY];
    if (!token) {
      return null;
    }
    if (isTokenSet(token)) {
      return token;
    }

    logWarn('storage', 'stored OAuth token was malformed and has been ignored');
    return null;
  } catch (error: unknown) {
    logError('storage', 'failed to load OAuth token', error);
    return null;
  }
}

export async function saveToken(token: OAuthTokenSet): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [TOKEN_KEY]: token });
  } catch (error: unknown) {
    logError('storage', 'failed to save OAuth token', error);
    throw error;
  }
}

export async function clearToken(): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  try {
    await storage.remove(TOKEN_KEY);
  } catch (error: unknown) {
    logError('storage', 'failed to clear OAuth token', error);
    throw error;
  }
}
