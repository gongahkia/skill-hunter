/**
 * Citation index loader & query helpers. Issue #3 — precomputed offline index of cases
 * that cite each section of an Act, bundled as static JSON assets.
 */

import type { CitationEntry, CitationIndex } from '@/types';
import { CITATION_ASSET_BASE_PATH, CITATION_TOP_N } from '@/utils/constants';
import { logger } from '@/utils/logger';

const indexLogger = logger.withContext('citationIndex');

/**
 * Pull the SSO Act slug from a /Act/ or /Act-Rev/ URL.
 * Example: `https://sso.agc.gov.sg/Act/PC1871?WholeDoc=1` → `PC1871`.
 */
export function extractActSlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'sso.agc.gov.sg') return null;
    const match = /^\/(?:Act|Act-Rev|SL|Bills-Supp)\/([^/?#]+)/.exec(parsed.pathname);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
}

function getExtensionResourceUrl(relativePath: string): string | null {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(relativePath);
    }
  } catch (error) {
    indexLogger.warn('chrome.runtime.getURL unavailable', { error });
  }
  return null;
}

/**
 * Fetch and parse the bundled citation index for an Act. Returns null when the
 * Act has no bundled index, when fetching fails, or when the runtime isn't a
 * browser extension context.
 */
export async function loadCitationIndex(actSlug: string): Promise<CitationIndex | null> {
  if (!actSlug) return null;
  const resourceUrl = getExtensionResourceUrl(`${CITATION_ASSET_BASE_PATH}${actSlug}.json`);
  if (!resourceUrl) return null;

  try {
    const response = await fetch(resourceUrl);
    if (!response.ok) {
      if (response.status !== 404) {
        indexLogger.warn('Citation index fetch failed', { actSlug, status: response.status });
      }
      return null;
    }
    const data = (await response.json()) as CitationIndex;
    if (!isCitationIndex(data)) {
      indexLogger.warn('Citation index payload failed shape check', { actSlug });
      return null;
    }
    return data;
  } catch (error) {
    indexLogger.warn('Citation index load threw', { actSlug, error });
    return null;
  }
}

function isCitationIndex(value: unknown): value is CitationIndex {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.actSlug === 'string' &&
    typeof obj.actName === 'string' &&
    obj.sections !== null &&
    typeof obj.sections === 'object'
  );
}

/**
 * Pick the top-N citations for a given section anchor id (e.g. `pr415-he-`).
 * The index is assumed to be sorted newest-first; this returns the first N entries.
 */
export function getTopCasesForSection(
  index: CitationIndex | null,
  sectionId: string,
  limit: number = CITATION_TOP_N
): CitationEntry[] {
  if (!index || !sectionId) return [];
  const entries = index.sections[sectionId];
  if (!Array.isArray(entries) || entries.length === 0) return [];
  return entries.slice(0, Math.max(0, limit));
}

/**
 * Map of section id → cases count, for badge rendering.
 */
export function summariseSectionCoverage(index: CitationIndex | null): Map<string, number> {
  const summary = new Map<string, number>();
  if (!index) return summary;
  for (const [sectionId, entries] of Object.entries(index.sections)) {
    if (Array.isArray(entries) && entries.length > 0) {
      summary.set(sectionId, entries.length);
    }
  }
  return summary;
}
