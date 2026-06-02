/**
 * Popup script - Controls the extension popup interface
 */

import type { ChromeMessage, ChromeMessageResponse, PageSummary } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';

const popupLogger = logger.withContext('popup');

const PROPERTY_FIELDS = ['propType', 'propStatus', 'propDate', 'propRevised', 'propPdf', 'propCitations', 'propSource'] as const;

function setStatus(message: string, variant: 'info' | 'error' | 'success' = 'info'): void {
  const statusEl = document.getElementById('statusMessage');
  if (!(statusEl instanceof HTMLElement)) {
    popupLogger.warn('Status element missing');
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove('status-error', 'status-success');

  if (variant === 'error') {
    statusEl.classList.add('status-error');
  }

  if (variant === 'success') {
    statusEl.classList.add('status-success');
  }
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
      error: 'Open a supported SSO legislation page to use Skill Hunter.',
    };
  }
}

function setToggleButtonState(disabled: boolean): void {
  const toggleButton = document.getElementById('toggleButton');
  if (toggleButton instanceof HTMLButtonElement) {
    toggleButton.disabled = disabled;
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

async function checkPageEligibility(): Promise<boolean> {
  setStatus('Checking current tab…');

  const eligibility = await sendMessageToActiveTab({ action: 'check_supported_page' });
  if (eligibility.status !== 'success') {
    renderEmptyProperties('Not an SSO page');
    setStatus(eligibility.error ?? 'This page is not supported.', 'error');
    return false;
  }

  const supportedPage = Boolean(eligibility.supportedPage);
  if (!supportedPage) {
    renderEmptyProperties('SSO Whole Document view required');
    setStatus('Open the SSO Whole Document view before toggling Skill Hunter.', 'error');
    return false;
  }

  const summaryResponse = await sendMessageToActiveTab({ action: 'get_page_summary' });
  if (summaryResponse.status === 'success' && summaryResponse.pageSummary) {
    renderPageSummary(summaryResponse.pageSummary);
    setStatus('Ready to open simplified research view.', 'success');
    return true;
  }

  renderEmptyProperties('Metadata unavailable');
  setStatus(summaryResponse.error ?? 'Could not read page metadata.', 'error');
  return false;
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

  setToggleButtonState(true);

  void (async () => {
    const eligible = await checkPageEligibility();
    setToggleButtonState(!eligible);
  })();

  const handleToggleClick = async (): Promise<void> => {
    setToggleButtonState(true);
    setStatus('Opening simplified view…');

    const response = await sendMessageToActiveTab({ action: 'toggle_simplified_view' });
    if (response.status === 'success') {
      setStatus('Opening view.', 'success');
      window.close();
      return;
    }

    setToggleButtonState(false);
    setStatus(response.error ?? 'Skill Hunter could not access this page.', 'error');
  };

  toggleButton.addEventListener('click', () => {
    void handleToggleClick();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
