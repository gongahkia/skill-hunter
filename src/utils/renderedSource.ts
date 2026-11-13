import type { FetchResponse } from '@/types';
import { isSourcePage } from '@/core/sourceSnapshot';

/** A single temporary inactive tab at a time; existing matching tabs are never closed. */
let rendering = Promise.resolve();
function normalizedQuery(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.sort();
  return params.toString();
}
function sameVersion(a: string, b: string): boolean {
  const x = new URL(a),
    y = new URL(b);
  return (
    x.origin === y.origin &&
    x.pathname.toLowerCase() === y.pathname.toLowerCase() &&
    normalizedQuery(x) === normalizedQuery(y)
  );
}
export async function renderedSource(url: string): Promise<FetchResponse> {
  if (!isSourcePage(url) || new URL(url).hostname !== 'sso.agc.gov.sg')
    return { ok: false, error: 'Unsupported rendered source' };
  let release: () => void = () => undefined;
  const previous = rendering;
  rendering = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  let created: number | undefined;
  try {
    const existing = (await chrome.tabs.query({ url: 'https://sso.agc.gov.sg/*' })).find(
      (tab) => tab.url && sameVersion(tab.url, url)
    );
    const tab = existing ?? (await chrome.tabs.create({ url, active: false }));
    if (!tab.id) throw new Error('Could not open source');
    if (!existing) created = tab.id;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const result: FetchResponse = await chrome.tabs.sendMessage(tab.id, {
          action: 'get_source_document',
        });
        if (
          result?.ok &&
          result.url &&
          sameVersion(result.url, url) &&
          isSourcePage(result.url) &&
          new URL(result.url).hostname === 'sso.agc.gov.sg'
        )
          return result;
        if (result?.error) return result;
      } catch {
        /* The source tab's content script may not be ready yet. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
      ok: false,
      url,
      error: 'SSO could not be read in the browser. Open the source to check its availability.',
    };
  } catch (error) {
    return { ok: false, url, error: error instanceof Error ? error.message : 'Source unavailable' };
  } finally {
    if (created !== undefined) {
      try {
        await chrome.tabs.remove(created);
      } catch {
        /* Already closed. */
      }
    }
    release();
  }
}
