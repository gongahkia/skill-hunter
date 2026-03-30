/**
 * Popup script - Controls the extension popup interface
 */

import type { ChromeMessage, ChromeMessageResponse } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';

const popupLogger = logger.withContext('popup');

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

async function checkPageEligibility(): Promise<boolean> {
  setStatus('Checking current tab...');

  const response = await sendMessageToActiveTab({ action: 'check_supported_page' });
  if (response.status !== 'success') {
    setStatus(response.error ?? 'This page is not supported.', 'error');
    return false;
  }

  const supportedPage = Boolean(response.supportedPage);
  if (!supportedPage) {
    setStatus('Open SSO Whole Document view before toggling Skill Hunter.', 'error');
    return false;
  }

  setStatus('Ready. Click to open simplified research view.', 'success');
  return true;
}

function registerGlobalErrorListeners(): void {
  window.addEventListener('error', (event) => {
    popupLogger.error('Unhandled popup runtime error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    popupLogger.error('Unhandled popup promise rejection', { reason: event.reason });
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
    setStatus('Opening simplified view...');

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
