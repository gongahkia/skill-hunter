import { BrowserTarget } from './types';

export function detectBrowserTarget(): BrowserTarget {
  if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Firefox/.test(navigator.userAgent)) {
    return 'safari';
  }

  if (typeof browser !== 'undefined' && browser?.runtime?.getBrowserInfo) {
    return 'firefox';
  }

  return 'chrome';
}
