/**
 * Storage and clipboard helper utilities for legal research workflows.
 */

import type { CitationFormat, LegislationNote } from '@/types';
import { STORAGE_KEYS, UX_LIMITS } from '@/utils/constants';
import { logger } from '@/utils/logger';

const storageLogger = logger.withContext('storage');

function supportsChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function buildStorageKey(statuteKey: string): string {
  return `${STORAGE_KEYS.NOTE_PREFIX}${statuteKey}`;
}

export function createStatuteKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const base = `${parsed.hostname}${parsed.pathname}`;
    const versionTag =
      parsed.searchParams.get('RevDate') ?? parsed.searchParams.get('ViewType') ?? '';
    return `${base}${versionTag ? `?${versionTag}` : ''}`;
  } catch (error) {
    storageLogger.warn('Failed to parse statute URL for storage key', { url, error });
    return `fallback-${Date.now().toString(36)}`;
  }
}

export async function readLegislationNote(statuteKey: string): Promise<LegislationNote | null> {
  const storageKey = buildStorageKey(statuteKey);

  try {
    if (supportsChromeStorage()) {
      const result = await chrome.storage.local.get(storageKey);
      return (result[storageKey] as LegislationNote | undefined) ?? null;
    }

    const serialized = window.localStorage.getItem(storageKey);
    return serialized ? (JSON.parse(serialized) as LegislationNote) : null;
  } catch (error) {
    storageLogger.error('Failed to read legislation note', { statuteKey, error });
    return null;
  }
}

export async function saveLegislationNote(note: LegislationNote): Promise<boolean> {
  const storageKey = buildStorageKey(note.statuteKey);

  try {
    if (note.note.length > UX_LIMITS.NOTE_MAX_CHARACTERS) {
      throw new Error(`Note exceeds ${UX_LIMITS.NOTE_MAX_CHARACTERS} character limit`);
    }

    if (supportsChromeStorage()) {
      await chrome.storage.local.set({ [storageKey]: note });
      return true;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(note));
    return true;
  } catch (error) {
    storageLogger.error('Failed to save legislation note', { statuteKey: note.statuteKey, error });
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    storageLogger.warn('navigator.clipboard failed, trying fallback copy flow', error);
  }

  try {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch (error) {
    storageLogger.error('Failed to copy text to clipboard', error);
    return false;
  }
}

export function formatCitation(
  format: CitationFormat,
  statuteTitle: string,
  sectionHeading: string,
  url: string
): string {
  const sectionNum = sectionHeading.match(/\d+[A-Z]?/i)?.[0] ?? '';
  switch (format) {
    case 'bluebook':
      return `${statuteTitle}, s ${sectionNum || sectionHeading}`.trim();
    case 'oscola':
      return `${statuteTitle}, s ${sectionNum || sectionHeading} <${url}>`.trim();
    default:
      return `${statuteTitle} | ${sectionHeading} | ${url}`;
  }
}

export function buildRevisionUrl(currentUrl: string, revDate: string): string {
  const url = new URL(currentUrl);
  url.searchParams.set('WholeDoc', '1');
  url.searchParams.set('RevDate', revDate);
  return url.toString();
}

export function exportLegislationNoteAsMarkdown(note: LegislationNote): string {
  return [
    `# ${note.statuteTitle}`,
    '',
    `- Source: ${note.statuteUrl}`,
    `- Updated: ${note.updatedAt}`,
    '',
    '## Notes',
    '',
    note.note.trim() || '(No notes yet)',
    '',
  ].join('\n');
}
