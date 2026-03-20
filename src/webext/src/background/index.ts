import { ExtensionIdentityAuthLauncher } from '../auth/launchers/chrome-firefox';
import { SafariBridgeAuthLauncher } from '../auth/launchers/safari';
import { GoogleAuthClient } from '../auth/google';
import { extensionBrowser } from '../browser-api';
import { getAllPrefixes } from '../parser';
import { detectBrowserTarget } from '../platform';
import { clearToken, loadSettings, saveSettings } from '../storage';
import {
  EditorContext,
  PopupState,
  RuntimeMessageMap,
  ScanResult,
  TagEntry,
} from '../types';
import { getEditorAdapter } from '../google/adapters';
import { parseEditorContext } from '../google/url-context';

type RuntimeRequest =
  | { type: 'getPopupState' }
  | { type: 'saveSettings'; payload: RuntimeMessageMap['saveSettings'] }
  | { type: 'scanCurrentDocument' }
  | { type: 'signOut' }
  | { type: 'navigateBestEffort'; payload: RuntimeMessageMap['navigateBestEffort'] }
  | { type: 'runMutation'; payload: RuntimeMessageMap['runMutation'] };

let lastScan: ScanResult | undefined;

function getAuthClient(): GoogleAuthClient {
  if (detectBrowserTarget() === 'safari') {
    return new GoogleAuthClient(new SafariBridgeAuthLauncher());
  }

  return new GoogleAuthClient(new ExtensionIdentityAuthLauncher());
}

async function getCurrentContext(): Promise<EditorContext | undefined> {
  const [activeTab] = await extensionBrowser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.url) {
    return undefined;
  }

  return parseEditorContext(activeTab.url) ?? undefined;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await extensionBrowser.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (_error) {
    // The file can already be present on the page after a prior injection.
  }
}

async function maybeRequestEditorOrigins(context: EditorContext): Promise<void> {
  const settings = await loadSettings();
  if (!settings.alwaysEnableOnGoogleEditors || !extensionBrowser.permissions?.request) {
    return;
  }

  const originByEditor: Record<typeof context.editor, string> = {
    docs: 'https://docs.google.com/document/*',
    sheets: 'https://docs.google.com/spreadsheets/*',
    slides: 'https://docs.google.com/presentation/*',
  };

  const origin = originByEditor[context.editor];
  const hasAccess = await extensionBrowser.permissions.contains({
    origins: [origin],
  });

  if (!hasAccess) {
    await extensionBrowser.permissions.request({
      origins: [origin],
    });
  }
}

async function scanCurrentDocument(): Promise<ScanResult> {
  const context = await getCurrentContext();
  if (!context) {
    throw new Error('Open a Google Docs, Sheets, or Slides file before scanning.');
  }

  await maybeRequestEditorOrigins(context);

  const settings = await loadSettings();
  const auth = getAuthClient();
  const accessToken = await auth.getAccessToken(context.editor, 'readonly');
  const adapter = getEditorAdapter(context.editor);
  const prefixes = getAllPrefixes(settings.customPrefixes);
  lastScan = await adapter.scan(context, prefixes, accessToken);
  return lastScan;
}

async function buildPopupState(): Promise<PopupState> {
  const state: PopupState = {
    browser: detectBrowserTarget(),
    settings: await loadSettings(),
  };

  const currentContext = await getCurrentContext();
  if (currentContext) {
    state.currentContext = currentContext;
  }

  if (lastScan) {
    state.lastScan = lastScan;
  }

  return state;
}

async function runMutation(action: 'highlight' | 'markDone' | 'archive', entries: TagEntry[]): Promise<ScanResult> {
  const context = await getCurrentContext();
  if (!context) {
    throw new Error('Open a Google Docs, Sheets, or Slides file before mutating tags.');
  }

  if (entries.length === 0) {
    throw new Error('Select at least one tag first.');
  }

  const auth = getAuthClient();
  const accessToken = await auth.getAccessToken(context.editor, 'write');
  const settings = await loadSettings();
  const adapter = getEditorAdapter(context.editor);

  if (action === 'highlight') {
    await adapter.highlight(context, entries, accessToken, settings.colorscheme);
  } else if (action === 'markDone') {
    await adapter.markDone(context, entries, accessToken);
  } else {
    await adapter.archive(context, entries, accessToken);
  }

  const prefixes = getAllPrefixes(settings.customPrefixes);
  lastScan = await adapter.scan(context, prefixes, accessToken);
  return lastScan;
}

async function navigateBestEffort(entry: TagEntry): Promise<boolean> {
  const [activeTab] = await extensionBrowser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return false;
  }

  await ensureContentScript(activeTab.id);
  const response = await extensionBrowser.tabs.sendMessage(activeTab.id, {
    type: 'owl:navigate',
    payload: entry,
  });

  return response?.ok ?? false;
}

extensionBrowser.runtime.onMessage.addListener(
  (request: RuntimeRequest, _sender: unknown, sendResponse: (value: unknown) => void) => {
    (async () => {
      switch (request.type) {
        case 'getPopupState':
          sendResponse({ ok: true, value: await buildPopupState() });
          break;
        case 'saveSettings':
          await saveSettings(request.payload);
          sendResponse({ ok: true });
          break;
        case 'scanCurrentDocument':
          sendResponse({ ok: true, value: await scanCurrentDocument() });
          break;
        case 'signOut':
          await clearToken();
          sendResponse({ ok: true });
          break;
        case 'navigateBestEffort':
          sendResponse({ ok: true, value: await navigateBestEffort(request.payload) });
          break;
        case 'runMutation':
          sendResponse({
            ok: true,
            value: await runMutation(request.payload.action, request.payload.entries),
          });
          break;
      }
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendResponse({ ok: false, error: message });
    });

    return true;
  }
);
