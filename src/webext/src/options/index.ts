import { COLORSCHEMES, DEFAULT_SETTINGS } from '../constants';
import { extensionBrowser } from '../browser-api';
import { formatDiagnosticsText, logError, logInfo } from '../logger';
import { loadSettings, saveSettings } from '../storage';
import { sanitizeCustomPrefixes } from '../parser';
import { DiagnosticEvent } from '../types';

type RuntimeResponse<T> = {
  ok: boolean;
  value?: T;
  error?: string;
};

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing options element: ${id}`);
  }
  return element as T;
}

function setStatus(message: string): void {
  elementById<HTMLParagraphElement>('status').textContent = message;
}

async function sendMessage<T>(message: unknown): Promise<T> {
  const response = (await extensionBrowser.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response.ok) {
    throw new Error(response.error ?? 'Unknown extension runtime error.');
  }
  return response.value as T;
}

async function boot(): Promise<void> {
  const settings = await loadSettings();
  const colorschemeSelect = elementById<HTMLSelectElement>('colorscheme');

  Object.keys(COLORSCHEMES).forEach((schemeName) => {
    const option = document.createElement('option');
    option.value = schemeName;
    option.textContent = schemeName;
    colorschemeSelect.appendChild(option);
  });

  colorschemeSelect.value = settings.colorscheme;
  elementById<HTMLInputElement>('custom-prefixes').value = settings.customPrefixes.join(', ');
  elementById<HTMLInputElement>('enable-google-hosts').checked = settings.alwaysEnableOnGoogleEditors;
  elementById<HTMLInputElement>('chrome-client-id').value = settings.oauthClientIds.chrome;
  elementById<HTMLInputElement>('firefox-client-id').value = settings.oauthClientIds.firefox;
  elementById<HTMLInputElement>('safari-client-id').value = settings.oauthClientIds.safari;

  elementById<HTMLButtonElement>('save-button').addEventListener('click', async () => {
    try {
      const nextSettings = {
        colorscheme: colorschemeSelect.value || DEFAULT_SETTINGS.colorscheme,
        customPrefixes: sanitizeCustomPrefixes(
          elementById<HTMLInputElement>('custom-prefixes').value.split(',')
        ),
        alwaysEnableOnGoogleEditors: elementById<HTMLInputElement>('enable-google-hosts').checked,
        oauthClientIds: {
          chrome: elementById<HTMLInputElement>('chrome-client-id').value.trim(),
          firefox: elementById<HTMLInputElement>('firefox-client-id').value.trim(),
          safari: elementById<HTMLInputElement>('safari-client-id').value.trim(),
        },
      };

      await saveSettings(nextSettings);
      await sendMessage<void>({
        type: 'saveSettings',
        payload: nextSettings,
      });
      logInfo('options', 'saved browser settings');
      setStatus('Saved Owl browser-extension settings.');
    } catch (error: unknown) {
      logError('options', 'failed to save settings', error);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  elementById<HTMLButtonElement>('copy-diagnostics-button').addEventListener('click', async () => {
    try {
      const diagnostics = await sendMessage<DiagnosticEvent[]>({
        type: 'getDiagnostics',
      });
      if (diagnostics.length === 0) {
        setStatus('No diagnostics available yet.');
        return;
      }

      await navigator.clipboard.writeText(formatDiagnosticsText(diagnostics));
      setStatus(`Copied ${diagnostics.length} diagnostic events.`);
    } catch (error: unknown) {
      logError('options', 'failed to copy diagnostics', error);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  elementById<HTMLButtonElement>('clear-diagnostics-button').addEventListener('click', async () => {
    try {
      await sendMessage<void>({ type: 'clearDiagnostics' });
      setStatus('Cleared runtime diagnostics.');
    } catch (error: unknown) {
      logError('options', 'failed to clear diagnostics', error);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });
}

boot().catch((error: unknown) => {
  logError('options', 'options page boot failed', error);
  setStatus(error instanceof Error ? error.message : String(error));
});
