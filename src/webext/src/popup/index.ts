import { extensionBrowser } from '../browser-api';
import { getPrefixColor } from '../colors';
import { logError, logInfo } from '../logger';
import { PopupState, ScanResult, TagEntry, WebExtSettings } from '../types';

type RuntimeResponse<T> = {
  ok: boolean;
  value?: T;
  error?: string;
};

const selectedEntryIds = new Set<string>();
let popupState: PopupState | undefined;

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing popup element: ${id}`);
  }
  return element as T;
}

async function sendMessage<T>(message: unknown): Promise<T> {
  const response = (await extensionBrowser.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response.ok) {
    throw new Error(response.error ?? 'Unknown extension error.');
  }
  return response.value as T;
}

function setStatus(message: string): void {
  elementById<HTMLParagraphElement>('status').textContent = message;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runUserAction(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error: unknown) {
    logError('popup', `${label} failed`, error);
    setStatus(getErrorMessage(error));
  }
}

function formatExport(result: ScanResult, mode: 'json' | 'md' | 'txt'): string {
  if (mode === 'json') {
    return JSON.stringify(result, null, 2);
  }

  const prefixGroups = new Map<string, TagEntry[]>();
  result.entries.forEach((entry) => {
    const current = prefixGroups.get(entry.prefix) ?? [];
    current.push(entry);
    prefixGroups.set(entry.prefix, current);
  });

  if (mode === 'md') {
    const lines = [`# Owl Tags Report`, ``, `## ${result.title}`, ``];
    prefixGroups.forEach((entries, prefix) => {
      lines.push(`### ${prefix} (${entries.length})`, ``);
      entries.forEach((entry) => {
        lines.push(`- ${entry.content} (${entry.locationLabel})`);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  const lines = [`${result.title}`, ''];
  prefixGroups.forEach((entries, prefix) => {
    lines.push(`${prefix}:`);
    entries.forEach((entry) => {
      lines.push(`  ${entry.locationLabel} ${entry.content}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

async function copyExport(mode: 'json' | 'md' | 'txt'): Promise<void> {
  if (!popupState?.lastScan) {
    setStatus('Scan the current document before exporting.');
    return;
  }

  const text = formatExport(popupState.lastScan, mode);
  await navigator.clipboard.writeText(text);
  logInfo('popup', 'copied export to clipboard', {
    mode,
    entries: popupState.lastScan.entries.length,
  });
  setStatus(`Copied ${mode.toUpperCase()} export to the clipboard.`);
}

function getSelectedEntries(result: ScanResult): TagEntry[] {
  return result.entries.filter((entry) => selectedEntryIds.has(entry.id));
}

function buildMutationPrompt(action: 'highlight' | 'markDone' | 'archive', entries: TagEntry[]): string {
  const previewLines = entries
    .slice(0, 3)
    .map((entry) => `- ${entry.locationLabel}: ${entry.content}`)
    .join('\n');

  return [
    `This will ${action} ${entries.length} tag${entries.length === 1 ? '' : 's'} in the current Google editor.`,
    '',
    previewLines,
    entries.length > 3 ? `\n...and ${entries.length - 3} more.` : '',
  ].join('\n');
}

async function runMutation(action: 'highlight' | 'markDone' | 'archive'): Promise<void> {
  if (!popupState?.lastScan) {
    setStatus('Scan the current document before mutating tags.');
    return;
  }

  const selectedEntries = getSelectedEntries(popupState.lastScan);
  if (selectedEntries.length === 0) {
    setStatus('Select at least one tag first.');
    return;
  }

  const confirmed = window.confirm(buildMutationPrompt(action, selectedEntries));
  if (!confirmed) {
    return;
  }

  setStatus(`Running ${action}...`);
  popupState.lastScan = await sendMessage<ScanResult>({
    type: 'runMutation',
    payload: {
      action,
      entries: selectedEntries,
    },
  });
  selectedEntryIds.clear();
  render();
  logInfo('popup', 'completed mutation', {
    action,
    entries: selectedEntries.length,
  });
  setStatus(`${action} completed.`);
}

async function navigate(entry: TagEntry): Promise<void> {
  const ok = await sendMessage<boolean>({
    type: 'navigateBestEffort',
    payload: entry,
  });
  if (!ok) {
    logError('popup', 'navigation request returned false', {
      entryId: entry.id,
      location: entry.locationLabel,
    });
  }
  setStatus(ok ? `Navigated to ${entry.locationLabel}.` : `Unable to navigate to ${entry.locationLabel}.`);
}

function renderEntries(result: ScanResult, settings: WebExtSettings): void {
  const container = elementById<HTMLDivElement>('entries');
  container.replaceChildren();

  if (result.entries.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Owl found no matching tags in the current document.';
    container.appendChild(empty);
    return;
  }

  const groups = new Map<string, TagEntry[]>();
  result.entries.forEach((entry) => {
    const current = groups.get(entry.prefix) ?? [];
    current.push(entry);
    groups.set(entry.prefix, current);
  });

  Array.from(groups.entries()).forEach(([prefix, entries]) => {
    const section = document.createElement('section');
    section.className = 'prefix-group';

    const header = document.createElement('h3');
    header.textContent = `${prefix} (${entries.length})`;
    header.style.color = getPrefixColor(settings.colorscheme, prefix, settings.customPrefixes);
    section.appendChild(header);

    entries.forEach((entry) => {
      const row = document.createElement('label');
      row.className = 'entry-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedEntryIds.has(entry.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedEntryIds.add(entry.id);
        } else {
          selectedEntryIds.delete(entry.id);
        }
      });

      const textButton = document.createElement('button');
      textButton.type = 'button';
      textButton.className = 'entry-text';
      textButton.textContent = entry.content || entry.rawText;
      textButton.addEventListener('click', async () => {
        await navigate(entry);
      });

      const meta = document.createElement('span');
      meta.className = 'entry-meta';
      meta.textContent = entry.locationLabel;

      row.appendChild(checkbox);
      row.appendChild(textButton);
      row.appendChild(meta);
      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

function renderContext(): void {
  const contextEl = elementById<HTMLParagraphElement>('context');
  const browserEl = elementById<HTMLSpanElement>('browser-name');
  if (!popupState) {
    contextEl.textContent = '';
    browserEl.textContent = '';
    return;
  }

  browserEl.textContent = popupState.browser;
  if (!popupState.currentContext) {
    contextEl.textContent = 'Open a Google Docs, Sheets, or Slides file to use Owl.';
    return;
  }

  contextEl.textContent = `Current editor: ${popupState.currentContext.editor} (${popupState.currentContext.documentId})`;
}

function render(): void {
  if (!popupState) {
    return;
  }

  renderContext();
  if (popupState.lastScan) {
    renderEntries(popupState.lastScan, popupState.settings);
  } else {
    elementById<HTMLDivElement>('entries').replaceChildren();
  }
}

async function boot(): Promise<void> {
  popupState = await sendMessage<PopupState>({ type: 'getPopupState' });
  render();

  elementById<HTMLButtonElement>('scan-button').addEventListener('click', async () => {
    await runUserAction('scan', async () => {
      setStatus('Scanning current document...');
      popupState!.lastScan = await sendMessage<ScanResult>({ type: 'scanCurrentDocument' });
      selectedEntryIds.clear();
      render();
      setStatus(`Found ${popupState!.lastScan.entries.length} tags.`);
    });
  });

  elementById<HTMLButtonElement>('highlight-button').addEventListener('click', async () => {
    await runUserAction('highlight mutation', async () => {
      await runMutation('highlight');
    });
  });

  elementById<HTMLButtonElement>('markdone-button').addEventListener('click', async () => {
    await runUserAction('mark-done mutation', async () => {
      await runMutation('markDone');
    });
  });

  elementById<HTMLButtonElement>('archive-button').addEventListener('click', async () => {
    await runUserAction('archive mutation', async () => {
      await runMutation('archive');
    });
  });

  elementById<HTMLButtonElement>('export-json-button').addEventListener('click', async () => {
    await runUserAction('JSON export', async () => {
      await copyExport('json');
    });
  });

  elementById<HTMLButtonElement>('export-md-button').addEventListener('click', async () => {
    await runUserAction('Markdown export', async () => {
      await copyExport('md');
    });
  });

  elementById<HTMLButtonElement>('export-txt-button').addEventListener('click', async () => {
    await runUserAction('text export', async () => {
      await copyExport('txt');
    });
  });

  elementById<HTMLButtonElement>('signout-button').addEventListener('click', async () => {
    await runUserAction('sign-out', async () => {
      await sendMessage<void>({ type: 'signOut' });
      setStatus('Cleared the cached Google OAuth token.');
    });
  });

  elementById<HTMLButtonElement>('options-button').addEventListener('click', async () => {
    await runUserAction('open settings', async () => {
      await extensionBrowser.runtime.openOptionsPage();
    });
  });
}

boot().catch((error: unknown) => {
  logError('popup', 'popup boot failed', error);
  setStatus(getErrorMessage(error));
});
