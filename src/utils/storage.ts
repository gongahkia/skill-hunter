/**
 * Storage and clipboard helper utilities for legal research workflows.
 */

import type { CitationFormat, DiagnosticLogEntry, LegislationNote } from '@/types';
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

function isLegislationNote(value: unknown, statuteKey: string): value is LegislationNote {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    item.statuteKey === statuteKey &&
    typeof item.statuteTitle === 'string' &&
    typeof item.statuteUrl === 'string' &&
    typeof item.note === 'string' &&
    item.note.length <= UX_LIMITS.NOTE_MAX_CHARACTERS &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}

export async function readLegislationNote(statuteKey: string): Promise<LegislationNote | null> {
  if (!supportsChromeStorage()) return null;
  try {
    const result = await chrome.storage.local.get(buildStorageKey(statuteKey));
    const value: unknown = result[buildStorageKey(statuteKey)];
    return isLegislationNote(value, statuteKey) ? value : null;
  } catch (error) {
    storageLogger.error('Failed to read legislation note', { statuteKey, error });
    return null;
  }
}

export async function saveLegislationNote(note: LegislationNote): Promise<boolean> {
  // Origin localStorage is readable by the host page. Never put research notes there.
  if (!supportsChromeStorage() || !isLegislationNote(note, note.statuteKey)) return false;
  try {
    await chrome.storage.local.set({ [buildStorageKey(note.statuteKey)]: note });
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

export function formatDiagnosticsReport(entries: DiagnosticLogEntry[], sessionId: string): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      entryCount: entries.length,
      entries,
    },
    null,
    2
  );
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
