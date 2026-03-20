/**
 * Popup script - Controls the extension popup interface
 */

import type { ChromeMessage, ChromeMessageResponse } from '@/types';

function setStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById('statusMessage');
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.toggle('status-error', isError);
}

async function sendMessageToActiveTab(message: ChromeMessage): Promise<ChromeMessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return { status: 'error', error: 'No active tab available.' };
    }

    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      status: 'unsupported_page',
      error: 'Open a supported SSO legislation page to use Skill Hunter.',
    };
  }
}

function initialize(): void {
  const toggleButton = document.getElementById('toggleButton');

  if (!(toggleButton instanceof HTMLButtonElement)) {
    console.error('Toggle button not found in popup');
    return;
  }

  const handleToggleClick = async (): Promise<void> => {
    toggleButton.disabled = true;
    setStatus('Checking page...');

    const response = await sendMessageToActiveTab({ action: 'toggle_simplified_view' });

    if (response.status === 'success') {
      window.close();
      return;
    }

    toggleButton.disabled = false;
    setStatus(response.error ?? 'Skill Hunter could not access this page.', true);
  };

  toggleButton.addEventListener('click', () => {
    void handleToggleClick();
  });

  setStatus('Use on SSO Whole Document pages only.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
