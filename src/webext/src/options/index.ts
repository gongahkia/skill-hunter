import { COLORSCHEMES, DEFAULT_SETTINGS } from '../constants';
import { extensionBrowser } from '../browser-api';
import { loadSettings, saveSettings } from '../storage';
import { sanitizeCustomPrefixes } from '../parser';

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
    await extensionBrowser.runtime.sendMessage({
      type: 'saveSettings',
      payload: nextSettings,
    });
    setStatus('Saved Owl browser-extension settings.');
  });
}

boot().catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : String(error));
});
