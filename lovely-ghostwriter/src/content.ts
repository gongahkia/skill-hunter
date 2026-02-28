/**
 * Content script - Main entry point for the browser extension
 */

import type { ChromeMessage, ChromeMessageResponse, HTMLContent, BackupContent } from '@/types';
import {
  getPageBasicData,
  getLegislationDefinitions,
  getLegislationContent,
} from '@/core/domParser';
import {
  integrateDefinitions,
  generateTableOfContentsHTML,
  generateContentHTML,
  PerformanceMonitor,
} from '@/core/contentProcessor';
import { logger } from '@/utils/logger';
import { handleError } from '@/utils/errorHandler';

// State management
let isSimplified = false;
let backupContent: BackupContent | null = null;

/**
 * Create the complete HTML content for the simplified view
 */
function createSimplifiedContent(): HTMLContent {
  const monitor = new PerformanceMonitor();
  monitor.start();

  // Extract data from DOM
  const { pageBasicData } = getPageBasicData();
  monitor.mark('Page data extracted');

  const legislationContent = getLegislationContent();
  monitor.mark('Content extracted');

  const legislationDefinitions = getLegislationDefinitions();
  monitor.mark('Definitions extracted');

  // Process content
  integrateDefinitions(legislationContent, legislationDefinitions);
  monitor.mark('Definitions integrated');

  // Generate HTML
  const tocHTML = generateTableOfContentsHTML(
    pageBasicData.legislationTitle,
    pageBasicData.tableOfContents
  );

  const contentHTML = generateContentHTML(legislationContent);
  monitor.mark('HTML generated');

  const totalTime = monitor.end();
  logger.info(`Content processing completed in ${totalTime.toFixed(2)}ms`);

  return {
    title: `Lovely Ghostwriter: ${pageBasicData.legislationTitle}`,
    style: '', // Styles are injected via CSS import
    content: `
      <div class="lovely-ghostwriter-container">
        ${tocHTML}
        <div class="main-content">
          <h1 class="page-title">${pageBasicData.legislationTitle}</h1>
          ${contentHTML}
        </div>
      </div>
    `,
  };
}

/**
 * Simplify the current page
 */
function simplifyPage(): void {
  try {
    logger.info('Simplifying page...');

    // Backup current state
    backupContent = {
      title: document.title,
      style: document.querySelector('style')?.innerHTML ?? null,
      content: document.body.innerHTML,
    };

    // Generate simplified content
    const simplifiedContent = createSimplifiedContent();

    // Apply changes
    document.title = simplifiedContent.title;
    document.body.innerHTML = simplifiedContent.content;

    // Add class to body for styling
    document.body.classList.add('lovely-ghostwriter-active');

    isSimplified = true;
    logger.info('Page simplified successfully');
  } catch (error) {
    handleError(error, 'simplifyPage');
  }
}

/**
 * Revert to original page
 */
function revertPage(): void {
  try {
    if (!backupContent) {
      logger.warn('No backup content available to revert');
      return;
    }

    logger.info('Reverting page...');

    document.title = backupContent.title;
    document.body.innerHTML = backupContent.content;

    if (backupContent.style) {
      const styleEl = document.querySelector('style') || document.createElement('style');
      styleEl.innerHTML = backupContent.style;
      if (!styleEl.parentElement) {
        document.head.appendChild(styleEl);
      }
    }

    document.body.classList.remove('lovely-ghostwriter-active');

    isSimplified = false;
    backupContent = null;
    logger.info('Page reverted successfully');
  } catch (error) {
    handleError(error, 'revertPage');
  }
}

/**
 * Handle messages from popup
 */
function handleMessage(
  message: ChromeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ChromeMessageResponse) => void
): boolean {
  logger.debug('Message received:', message);

  try {
    switch (message.action) {
      case 'simplify':
        if (message.toggle) {
          if (isSimplified) {
            revertPage();
          } else {
            simplifyPage();
          }
        } else {
          simplifyPage();
        }
        sendResponse({ status: 'success' });
        break;

      case 'cancel':
        logger.info('Cancel action received');
        sendResponse({ status: 'success' });
        break;

      default:
        logger.warn(`Unknown action: ${message.action}`);
        sendResponse({ status: 'error', error: 'Unknown action' });
    }
  } catch (error) {
    handleError(error, 'handleMessage');
    sendResponse({ status: 'error', error: String(error) });
  }

  return true; // Keep message channel open for async response
}

/**
 * Initialize content script
 */
function initialize(): void {
  logger.info('Lovely Ghostwriter content script initialized');

  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Navigate to bottom of page if on WholeDoc view
  // This ensures the full document is loaded
  if (window.location.href.endsWith('?WholeDoc=1')) {
    const { pageBasicData } = getPageBasicData();
    const toc = pageBasicData.tableOfContents;

    if (toc.length > 0) {
      const lastSection = toc[toc.length - 1];
      logger.debug('Navigating to last section to ensure full document load');
      window.location.href = lastSection.referenceUrl;
    }
  }
}

// Start the extension
initialize();

