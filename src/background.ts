import type { FetchResponse, Lookup } from '@/types';
import { fetchLookup, isSupportedUrl } from '@/utils/network';

// Two concurrent network requests across all tabs. Do not retain response content.
let active = 0;
const queue: Array<() => void> = [];
async function limitedFetch(lookup: Lookup): Promise<FetchResponse> {
  if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try {
    return await fetchLookup(lookup);
  } finally {
    active--;
    queue.shift()?.();
  }
}
chrome.runtime.onMessage.addListener(
  (message: unknown, sender, respond: (response: FetchResponse) => void) => {
    if (
      !message ||
      typeof message !== 'object' ||
      !('action' in message) ||
      message.action !== 'lookup'
    )
      return false;
    if (
      sender.id !== chrome.runtime.id ||
      !sender.tab ||
      !sender.url ||
      !isSupportedUrl(sender.url)
    ) {
      respond({ ok: false, error: 'Unsupported sender' });
      return false;
    }
    const lookup = 'lookup' in message ? message.lookup : null;
    if (
      !lookup ||
      typeof lookup !== 'object' ||
      !('kind' in lookup) ||
      !['document', 'statute-search', 'case-search'].includes(String(lookup.kind))
    ) {
      respond({ ok: false, error: 'Invalid lookup' });
      return false;
    }
    if (queue.length >= 12) {
      respond({ ok: false, error: 'Too many pending lookups; try again shortly.' });
      return false;
    }
    void limitedFetch(lookup as Lookup)
      .then(respond)
      .catch(() => respond({ ok: false, error: 'Source unavailable' }));
    return true;
  }
);
