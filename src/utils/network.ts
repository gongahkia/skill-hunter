import type { FetchResponse, Lookup } from '@/types';

export function isSupportedUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      ((u.hostname === 'sso.agc.gov.sg' &&
        /^\/(Act|Act-Rev|SL|Bills-Supp)\/[^/]+\/?$/i.test(u.pathname)) ||
        (u.hostname === 'www.elitigation.sg' &&
          /^\/(?:gd|gdviewer)\/s\/\d{4}_SG[A-Z]+_\d+\/?$/.test(u.pathname)))
    );
  } catch {
    return false;
  }
}
export function lookupUrl(lookup: Lookup): string {
  if (lookup.kind === 'rendered') return lookupUrl(lookup.resource);
  if (lookup.kind === 'statute-catalogue') return 'https://sso.agc.gov.sg/Act';
  if (lookup.kind === 'document') {
    if (!isSupportedUrl(lookup.url)) throw new Error('Unsupported source URL');
    return lookup.url;
  }
  const phrase = lookup.kind === 'statute-search' ? lookup.title : lookup.phrase;
  if (typeof phrase !== 'string' || !phrase.trim() || phrase.length > 300)
    throw new Error('Invalid search');
  const url = new URL(
    lookup.kind === 'statute-search'
      ? 'https://sso.agc.gov.sg/Search/Content'
      : 'https://www.elitigation.sg/gdviewer/Home/Index'
  );
  if (lookup.kind === 'statute-search') {
    url.searchParams.set('Phrase', phrase);
    url.searchParams.set('PhraseType', 'AllTheseWords');
    url.searchParams.set('Within', 'title');
    url.searchParams.set('In', 'InForce_Act_SL');
  } else {
    url.searchParams.set('SearchPhrase', phrase);
    url.searchParams.set('SearchMode', 'True');
    url.searchParams.set('SortBy', 'Score');
    url.searchParams.set('SortAscending', 'False');
    url.searchParams.set('Filter', 'SUPCT');
  }
  return url.href;
}

// No storage or HTTP cache: fetched content lives only for the active lookup/page.
export async function fetchLookup(lookup: Lookup): Promise<FetchResponse> {
  const url = lookupUrl(lookup);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Source did not return HTML');
    if (Number(response.headers.get('content-length')) > 8_000_000)
      throw new Error('Source document is too large');
    // Bound decompressed response size as well as Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Source response is empty');
    const decoder = new TextDecoder();
    let html = '',
      size = 0;
    let reading = true;
    while (reading) {
      const chunk = await reader.read();
      if (chunk.done) {
        reading = false;
        break;
      }
      size += chunk.value.byteLength;
      if (size > 8_000_000) {
        await reader.cancel();
        throw new Error('Source document is too large');
      }
      html += decoder.decode(chunk.value, { stream: true });
    }
    html += decoder.decode();
    return { ok: true, html, url };
  } catch (error) {
    return { ok: false, url, error: error instanceof Error ? error.message : 'Source unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
