import type { ChromeMessage, ChromeMessageResponse } from '@/types';
import { Annotations } from '@/core/annotations';
import { HoverCard } from '@/core/card';
import { contentRoot, pageSummary } from '@/core/sources';
import { ENABLED_KEY } from '@/utils/constants';
import { isSupportedUrl } from '@/utils/network';

let annotations: Annotations | null = null;
let card: HoverCard | null = null;
let enabled = false;
let scheduled = 0;
const style = document.createElement('style');
style.textContent = `.skill-hunter-reference[data-skill-hunter-reference] { text-decoration-line: underline !important; text-decoration-style: dotted !important; text-decoration-color: #a12830 !important; text-underline-offset: 3px !important; cursor: help; }
.skill-hunter-reference[data-skill-hunter-reference]:focus-visible { outline: 2px solid #a12830; outline-offset: 2px; }`;
function scan(): void {
  scheduled = 0;
  if (!enabled) return;
  observer.disconnect();
  if (annotations && !annotations.connected) {
    card?.destroy();
    card = null;
    annotations.clear();
    annotations = null;
  }
  const root = contentRoot(document);
  if (root && !annotations) {
    annotations = new Annotations(root, location.href);
    card = new HoverCard(annotations, location.href);
  }
  try {
    annotations?.scan();
  } finally {
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
}
const observer = new MutationObserver(() => {
  if (!scheduled) scheduled = window.setTimeout(scan, 120);
});
function applyEnabled(value: boolean): void {
  enabled = value;
  if (value) {
    if (!style.isConnected) document.head.append(style);
    scan();
  } else {
    observer.disconnect();
    window.clearTimeout(scheduled);
    scheduled = 0;
    card?.destroy();
    card = null;
    annotations?.clear();
    annotations = null;
    style.remove();
  }
}
chrome.runtime.onMessage.addListener(
  (message: ChromeMessage, _sender, respond: (response: ChromeMessageResponse) => void) => {
    if (message.action === 'check_supported_page') {
      respond({ status: 'success', supportedPage: isSupportedUrl(location.href), enabled });
      return false;
    }
    if (message.action === 'get_page_summary') {
      respond({ status: 'success', enabled, pageSummary: pageSummary(document, location.href) });
      return false;
    }
    return false;
  }
);
let settingChanged = false;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ENABLED_KEY in changes) {
    settingChanged = true;
    applyEnabled(changes[ENABLED_KEY]?.newValue === true);
  }
});
void chrome.storage.local
  .get(ENABLED_KEY)
  .then((settings) => {
    if (!settingChanged) applyEnabled(settings[ENABLED_KEY] === true);
  })
  .catch(() => applyEnabled(false));
