import { DEFAULT_SETTINGS } from './constants';
import { OAuthTokenSet, WebExtSettings } from './types';
import { extensionBrowser } from './browser-api';

const SETTINGS_KEY = 'owl-webext-settings';
const TOKEN_KEY = 'owl-webext-token';

function getStorageArea(): any {
  return extensionBrowser.storage?.local;
}

export async function loadSettings(): Promise<WebExtSettings> {
  const storage = getStorageArea();
  if (!storage) {
    return DEFAULT_SETTINGS;
  }

  const result = await storage.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result?.[SETTINGS_KEY] ?? {}),
    oauthClientIds: {
      ...DEFAULT_SETTINGS.oauthClientIds,
      ...(result?.[SETTINGS_KEY]?.oauthClientIds ?? {}),
    },
  };
}

export async function saveSettings(settings: WebExtSettings): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({ [SETTINGS_KEY]: settings });
}

export async function loadToken(): Promise<OAuthTokenSet | null> {
  const storage = getStorageArea();
  if (!storage) {
    return null;
  }

  const result = await storage.get(TOKEN_KEY);
  return result?.[TOKEN_KEY] ?? null;
}

export async function saveToken(token: OAuthTokenSet): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.remove(TOKEN_KEY);
}
