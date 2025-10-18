/**
 * Background service worker - Handles extension lifecycle and background tasks
 */

/**
 * Handle extension installation or update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.info('Skill Hunter installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.info('Welcome to Skill Hunter!');

    // Set default preferences
    chrome.storage.sync.set({
      colorScheme: 'light',
      fontFamily: 'default',
    });
  } else if (details.reason === 'update') {
    // Extension updated
    const previousVersion = details.previousVersion;
    console.info(`Updated from version ${previousVersion ?? 'unknown'}`);
  }
});

/**
 * Handle browser action click (if needed for future features)
 */
chrome.action.onClicked.addListener((tab) => {
  console.info('Extension icon clicked for tab:', tab.id);

  // Future: Could add additional functionality here
});

/**
 * Handle messages from content scripts or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.info('Background received message:', message, 'from:', sender);

  // Handle different message types
  switch (message.action) {
    case 'getPreferences':
      chrome.storage.sync.get(['colorScheme', 'fontFamily'], (result) => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response

    case 'setPreferences':
      chrome.storage.sync.set(message.preferences, () => {
        sendResponse({ status: 'success' });
      });
      return true;

    default:
      sendResponse({ status: 'unknown_action' });
  }

  return false;
});

/**
 * Monitor tab updates (optional - for future features)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if the tab is on an SSO page
    const ssoPattern = /https:\/\/sso\.agc\.gov\.sg\/(Act|SL|Bills-Supp)\/.*\?WholeDoc=1/;

    if (ssoPattern.test(tab.url)) {
      console.info('SSO legislation page detected:', tab.url);

      // Future: Could show a page action or notification
    }
  }
});

console.info('Skill Hunter background service worker initialized');

