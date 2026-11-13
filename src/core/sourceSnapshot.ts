import type { FetchResponse } from '@/types';
import { isSupportedUrl } from '@/utils/network';

export function isSourcePage(value: string): boolean {
  if (isSupportedUrl(value)) return true;
  try {
    const u = new URL(value);
    return (
      u.origin === 'https://sso.agc.gov.sg' && ['/Act', '/Search/Content'].includes(u.pathname)
    );
  } catch {
    return false;
  }
}
/** Read the browser-rendered source, without modifying it or keeping a stored copy. */
export function sourceSnapshot(
  doc: Document,
  url: string,
  timeoutMs = 15000
): Promise<FetchResponse> {
  return new Promise((resolve) => {
    if (!isSourcePage(url)) {
      resolve({ ok: false, error: 'Unsupported source page' });
      return;
    }
    const u = new URL(url);
    const isSearch = ['/Act', '/Search/Content'].includes(u.pathname);
    let settled = false;
    const finish = (response: FetchResponse): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      observer.disconnect();
      resolve(response);
    };
    const check = (): void => {
      const root = doc.querySelector('#legisContent');
      const ready = isSearch
        ? Array.from(doc.querySelectorAll('a[href]')).some((a) =>
            /\/(?:Act|SL)\//i.test(a.getAttribute('href') ?? '')
          )
        : !!root?.querySelector('[id*="-he-"], [class*="prov"][class*="Txt"]');
      if (!ready) return;
      const clone = doc.documentElement.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('#skill-hunter-previews, script, style, link, img, iframe, object, embed')
        .forEach((el) => el.remove());
      clone
        .querySelectorAll('[data-skill-hunter-reference]')
        .forEach((el) => el.replaceWith(...Array.from(el.childNodes)));
      const html = clone.outerHTML;
      finish(
        html.length <= 8_000_000
          ? { ok: true, html, url }
          : { ok: false, error: 'Source document is too large' }
      );
    };
    const observer = new MutationObserver(check);
    const timeout = setTimeout(
      () =>
        finish({
          ok: false,
          url,
          error:
            'SSO did not provide readable content in the browser. Open the source to check its availability.',
        }),
      timeoutMs
    );
    observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
    check();
  });
}
