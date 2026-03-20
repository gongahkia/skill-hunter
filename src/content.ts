/**
 * Content script - Main entry point for the browser extension
 */

import type { ChromeMessage, ChromeMessageResponse, HTMLContent } from '@/types';
import {
  getPageBasicData,
  getLegislationDefinitions,
  getLegislationContent,
} from '@/core/domParser';
import {
  generateContentHTML,
  generateTableOfContentsHTML,
  integrateDefinitions,
  PerformanceMonitor,
} from '@/core/contentProcessor';
import { SKILL_HUNTER_IDS } from '@/utils/constants';
import { handleError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';
import mainStyles from '@/styles/main.css?inline';

let isSimplified = false;
let overlayHost: HTMLDivElement | null = null;
let originalDocumentTitle = document.title;
let originalDocumentOverflow = '';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isWholeDocumentView(): boolean {
  return new URL(window.location.href).searchParams.get('WholeDoc') === '1';
}

function createSimplifiedContent(): HTMLContent {
  const monitor = new PerformanceMonitor();
  monitor.start();

  const { pageBasicData } = getPageBasicData();
  monitor.mark('Page data extracted');

  const legislationContent = getLegislationContent();
  monitor.mark('Content extracted');

  const legislationDefinitions = getLegislationDefinitions();
  monitor.mark('Definitions extracted');

  integrateDefinitions(legislationContent, legislationDefinitions);
  monitor.mark('Definitions integrated');

  const tocHTML = generateTableOfContentsHTML(
    pageBasicData.legislationTitle,
    pageBasicData.tableOfContents
  );
  const contentHTML = generateContentHTML(legislationContent);
  monitor.mark('HTML generated');

  const totalTime = monitor.end();
  logger.info(`Content processing completed in ${totalTime.toFixed(2)}ms`);

  return {
    title: `Skill Hunter: ${pageBasicData.legislationTitle}`,
    content: `
      <div class="skill-hunter-root">
        <div class="skill-hunter-toolbar">
          <div class="skill-hunter-toolbar-copy">
            <span class="skill-hunter-badge">Skill Hunter</span>
            <p class="skill-hunter-subtitle">Simplified reading view for Singapore legislation</p>
          </div>
          <button type="button" class="skill-hunter-close" ${SKILL_HUNTER_IDS.ACTION_ATTR}="close">
            Close simplified view
          </button>
        </div>
        <div class="skill-hunter-layout">
          ${tocHTML}
          <main class="main-content" aria-label="Simplified legislation">
            <h1 class="page-title">${escapeHtml(pageBasicData.legislationTitle)}</h1>
            ${contentHTML}
          </main>
        </div>
      </div>
    `,
  };
}

function handleOverlayClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element) || !overlayHost?.shadowRoot) {
    return;
  }

  const actionElement = target.closest<HTMLElement>(`[${SKILL_HUNTER_IDS.ACTION_ATTR}]`);
  if (actionElement?.dataset.skillHunterAction === 'close') {
    revertPage();
    return;
  }

  const tocElement = target.closest<HTMLElement>(`[${SKILL_HUNTER_IDS.TOC_TARGET_ATTR}]`);
  const targetId = tocElement?.dataset.skillHunterScrollTarget;
  if (!targetId) {
    return;
  }

  const targetNode = overlayHost.shadowRoot.getElementById(targetId);
  targetNode?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createMarkupFragment(markup: string): DocumentFragment {
  const range = document.createRange();
  range.selectNode(document.body);
  return range.createContextualFragment(markup);
}

function simplifyPage(): void {
  if (isSimplified) {
    return;
  }

  logger.info('Simplifying page...');

  originalDocumentTitle = document.title;
  originalDocumentOverflow = document.documentElement.style.overflow;

  const simplifiedContent = createSimplifiedContent();
  const host = document.createElement('div');
  host.id = SKILL_HUNTER_IDS.ROOT_HOST;

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = mainStyles;

  const mountEl = document.createElement('div');
  mountEl.appendChild(createMarkupFragment(simplifiedContent.content));
  mountEl.addEventListener('click', handleOverlayClick);

  shadowRoot.append(styleEl, mountEl);

  document.body.appendChild(host);
  document.documentElement.style.overflow = 'hidden';
  document.title = simplifiedContent.title;

  overlayHost = host;
  isSimplified = true;

  logger.info('Page simplified successfully');
}

function revertPage(): void {
  if (!isSimplified || !overlayHost) {
    return;
  }

  logger.info('Reverting page...');

  overlayHost.remove();
  overlayHost = null;
  document.documentElement.style.overflow = originalDocumentOverflow;
  document.title = originalDocumentTitle;
  isSimplified = false;

  logger.info('Page reverted successfully');
}

function toggleSimplifiedView(): ChromeMessageResponse {
  try {
    if (isSimplified) {
      revertPage();
      return { status: 'success', isSimplified: false };
    }

    if (!isWholeDocumentView()) {
      return {
        status: 'unsupported_page',
        error: 'Open the SSO Whole Document view before using Skill Hunter.',
      };
    }

    simplifyPage();
    return { status: 'success', isSimplified: true };
  } catch (error) {
    handleError(error, 'toggleSimplifiedView');
    return { status: 'error', error: 'Skill Hunter could not simplify this page.' };
  }
}

function handleMessage(
  message: ChromeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ChromeMessageResponse) => void
): boolean {
  logger.debug('Message received:', message);

  if (message.action !== 'toggle_simplified_view') {
    sendResponse({ status: 'error', error: 'Unknown action' });
    return false;
  }

  sendResponse(toggleSimplifiedView());
  return false;
}

function initialize(): void {
  logger.info('Skill Hunter content script initialized');
  chrome.runtime.onMessage.addListener(handleMessage);
}

initialize();
