/**
 * Popup script - Controls the extension popup interface
 */

import type { ChromeMessage } from '@/types';

// Import popup styles
import '@/styles/popup.css';

/**
 * Send message to active tab
 */
async function sendMessageToActiveTab(message: ChromeMessage): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      console.error('No active tab found');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, message);
    console.info('Message sent to tab:', message);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

/**
 * Initialize popup UI
 */
function initialize(): void {
  const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement | null;
  const simplifyButton = document.getElementById('simplifyButton') as HTMLButtonElement | null;

  if (!cancelButton || !simplifyButton) {
    console.error('Required buttons not found in popup');
    return;
  }

  // Cancel button handler
  cancelButton.addEventListener('click', async () => {
    console.info('Cancel button clicked');
    await sendMessageToActiveTab({ action: 'cancel' });
    window.close();
  });

  // Simplify button handler
  simplifyButton.addEventListener('click', async () => {
    console.info('Simplify button clicked');
    await sendMessageToActiveTab({ action: 'simplify', toggle: true });
    window.close();
  });

  console.info('Popup initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

