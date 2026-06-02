/**
 * Popup script - Controls the extension popup interface
 */

import type { ChromeMessage, ChromeMessageResponse, PageSummary } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';

const popupLogger = logger.withContext('popup');

const PROPERTY_FIELDS = [
  'propType',
  'propStatus',
  'propDate',
  'propRevised',
  'propPdf',
  'propCitations',
  'propSource',
] as const;

type ButtonState = 'loading' | 'ready' | 'unsupported' | 'error';

function setButton(state: ButtonState, label: string): void {
  const btn = document.getElementById('toggleButton');
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.dataset.state = state;
  btn.textContent = label;
  btn.disabled = state !== 'ready';
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function sendMessageToActiveTab(message: ChromeMessage): Promise<ChromeMessageResponse> {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      return { status: 'error', error: 'No active tab available.' };
    }
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    handleError(error, 'popup.sendMessageToActiveTab');
    return {
      status: 'unsupported_page',
      error: 'Open a supported SSO legislation page.',
    };
  }
}

function setTitle(title: string, isEmpty: boolean): void {
  const titleEl = document.getElementById('statuteTitle');
  if (!(titleEl instanceof HTMLElement)) return;
  titleEl.textContent = title;
  titleEl.classList.toggle('popup-title-empty', isEmpty);
}

function setPropertyValue(id: string, value: string, opts?: { href?: string }): void {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return;
  el.textContent = '';
  const empty = !value || value === '—';
  el.classList.toggle('popup-property-empty', empty);
  if (empty) {
    el.textContent = '—';
    return;
  }
  if (opts?.href) {
    const link = document.createElement('a');
    link.href = opts.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = value;
    el.appendChild(link);
    return;
  }
  el.textContent = value;
}

function truncateUrl(url: string, maxLen = 48): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const truncatedPath = u.pathname.length > 24 ? `${u.pathname.slice(0, 24)}…` : u.pathname;
    return `${u.hostname}${truncatedPath}`;
  } catch {
    return `${url.slice(0, maxLen)}…`;
  }
}

function renderPageSummary(summary: PageSummary): void {
  setTitle(summary.title, false);
  setPropertyValue('propType', summary.type);
  setPropertyValue('propStatus', summary.status);
  setPropertyValue('propDate', summary.date);
  setPropertyValue('propRevised', summary.revisedTitle);
  setPropertyValue('propPdf', summary.hasPdf ? 'Official PDF available' : 'Not available');
  setPropertyValue(
    'propCitations',
    summary.citationCount > 0
      ? `${summary.citationCount} case${summary.citationCount === 1 ? '' : 's'} indexed`
      : summary.actSlug
        ? 'No indexed citations yet'
        : 'Index not available'
  );
  setPropertyValue('propSource', truncateUrl(summary.sourceUrl), { href: summary.sourceUrl });
}

function renderEmptyProperties(reason: string): void {
  setTitle(reason, true);
  for (const id of PROPERTY_FIELDS) {
    setPropertyValue(id, '');
  }
}

async function checkPageEligibility(): Promise<void> {
  setButton('loading', 'Checking current tab…');

  const eligibility = await sendMessageToActiveTab({ action: 'check_supported_page' });
  if (eligibility.status !== 'success') {
    renderEmptyProperties('Not an SSO page');
    setButton('unsupported', 'Open an SSO legislation page');
    return;
  }

  if (!eligibility.supportedPage) {
    renderEmptyProperties('SSO Whole Document view required');
    setButton('unsupported', 'Switch to Whole Document view');
    return;
  }

  const summaryResponse = await sendMessageToActiveTab({ action: 'get_page_summary' });
  if (summaryResponse.status === 'success' && summaryResponse.pageSummary) {
    renderPageSummary(summaryResponse.pageSummary);
    setButton('ready', 'Open simplified research view');
    return;
  }

  renderEmptyProperties('Metadata unavailable');
  setButton('error', summaryResponse.error ?? 'Could not read page metadata');
}

function registerGlobalErrorListeners(): void {
  window.addEventListener('error', (event) => {
    popupLogger.error('Unhandled popup runtime error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error as unknown,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    popupLogger.error('Unhandled popup promise rejection', { reason: event.reason as unknown });
  });
}

function initialize(): void {
  registerGlobalErrorListeners();

  const toggleButton = document.getElementById('toggleButton');
  if (!(toggleButton instanceof HTMLButtonElement)) {
    popupLogger.error('Toggle button not found in popup');
    return;
  }

  void checkPageEligibility();

  toggleButton.addEventListener('click', () => {
    if (toggleButton.disabled) return;
    void (async () => {
      setButton('loading', 'Opening…');
      const response = await sendMessageToActiveTab({ action: 'toggle_simplified_view' });
      if (response.status === 'success') {
        window.close();
        return;
      }
      setButton('error', response.error ?? 'Skill Hunter could not access this page');
    })();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
