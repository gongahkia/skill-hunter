/**
 * Content script - Main entry point for the browser extension
 */

import type {
  ChromeMessage,
  ChromeMessageResponse,
  HTMLContent,
  LegislationNote,
} from '@/types';
import {
  getPageBasicData,
  getLegislationDefinitions,
  getLegislationContent,
  getLegislationMetadata,
} from '@/core/domParser';
import {
  generateContentHTML,
  generateTableOfContentsHTML,
  generateMetadataSummaryHTML,
  integrateDefinitions,
  PerformanceMonitor,
} from '@/core/contentProcessor';
import { SKILL_HUNTER_IDS, UX_LIMITS } from '@/utils/constants';
import { getUserFacingErrorMessage, handleError } from '@/utils/errorHandler';
import type { NormalizedError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';
import {
  copyTextToClipboard,
  createStatuteKeyFromUrl,
  exportLegislationNoteAsMarkdown,
  readLegislationNote,
  saveLegislationNote,
} from '@/utils/storage';
import mainStyles from '@/styles/main.css?inline';

const contentLogger = logger.withContext('contentScript');

let isSimplified = false;
let overlayHost: HTMLDivElement | null = null;
let originalDocumentTitle = document.title;
let originalDocumentOverflow = '';
let statuteKey = '';
let statuteTitle = '';
let searchResults: HTMLElement[] = [];
let activeSearchResultIndex = -1;
let noteDraft = '';
let noteSaveTimeoutId: number | null = null;
let toastTimeoutId: number | null = null;
let errorListenersRegistered = false;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWholeDocumentView(): boolean {
  return new URL(window.location.href).searchParams.get('WholeDoc') === '1';
}

function createSimplifiedContent(): HTMLContent {
  const monitor = new PerformanceMonitor();
  monitor.start();

  const { pageBasicData } = getPageBasicData();
  const legislationMetadata = getLegislationMetadata();
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
  const metadataHTML = generateMetadataSummaryHTML(pageBasicData, legislationMetadata);
  const contentHTML = generateContentHTML(legislationContent);
  monitor.mark('HTML generated');

  const totalTime = monitor.end();
  contentLogger.info('Content processing completed', {
    totalTimeMs: totalTime.toFixed(2),
    definitions: legislationDefinitions.length,
    tokens: legislationContent.length,
  });

  statuteTitle = pageBasicData.legislationTitle || 'Untitled Legislation';

  return {
    title: `Skill Hunter: ${pageBasicData.legislationTitle}`,
    content: `
      <div class="skill-hunter-root">
        <div class="skill-hunter-toolbar">
          <div class="skill-hunter-toolbar-copy">
            <span class="skill-hunter-badge">Skill Hunter</span>
            <p class="skill-hunter-subtitle">Legal reading and note-taking workspace for Singapore legislation</p>
          </div>
          <div class="skill-hunter-toolbar-actions">
            <div class="search-group" aria-label="Search statute text">
              <input
                id="${SKILL_HUNTER_IDS.SEARCH_INPUT_ID}"
                class="search-input"
                type="search"
                placeholder="Search within this statute"
                maxlength="${UX_LIMITS.SEARCH_QUERY_MAX_CHARACTERS}"
              />
              <button id="${SKILL_HUNTER_IDS.SEARCH_PREV_ID}" class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="search-prev">Prev</button>
              <button id="${SKILL_HUNTER_IDS.SEARCH_NEXT_ID}" class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="search-next">Next</button>
              <span id="${SKILL_HUNTER_IDS.SEARCH_COUNT_ID}" class="search-count" aria-live="polite">0 results</span>
            </div>
            <button id="${SKILL_HUNTER_IDS.COPY_CITATION_ID}" class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="copy-citation">Copy citation</button>
            <button id="${SKILL_HUNTER_IDS.COPY_LINK_ID}" class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="copy-link">Copy page link</button>
            <button id="${SKILL_HUNTER_IDS.EXPORT_NOTE_ID}" class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="export-note">Export notes</button>
            <button type="button" class="skill-hunter-close" ${SKILL_HUNTER_IDS.ACTION_ATTR}="close">Close</button>
          </div>
        </div>
        <div class="skill-hunter-layout">
          ${tocHTML}
          <main id="${SKILL_HUNTER_IDS.MAIN_CONTENT_ID}" class="main-content" aria-label="Simplified legislation">
            <h1 class="page-title">${escapeHtml(pageBasicData.legislationTitle)}</h1>
            ${metadataHTML}
            ${contentHTML}
          </main>
          <aside id="${SKILL_HUNTER_IDS.NOTE_PANEL_ID}" class="note-panel" aria-label="Research notes">
            <h2 class="note-panel-title">Research Notes</h2>
            <p class="note-panel-caption">Saved privately in your browser for this statute.</p>
            <textarea
              id="${SKILL_HUNTER_IDS.NOTE_TEXTAREA_ID}"
              class="note-textarea"
              maxlength="${UX_LIMITS.NOTE_MAX_CHARACTERS}"
              placeholder="Capture issue spots, authorities, and follow-up actions here..."
            ></textarea>
            <div class="note-footer">
              <span id="${SKILL_HUNTER_IDS.NOTE_STATUS_ID}" class="note-status" aria-live="polite">No note saved yet.</span>
              <span class="note-counter">0/${UX_LIMITS.NOTE_MAX_CHARACTERS}</span>
            </div>
          </aside>
        </div>
        <div id="${SKILL_HUNTER_IDS.TOAST_ID}" class="skill-hunter-toast" role="status" aria-live="polite"></div>
      </div>
    `,
  };
}

function getOverlayShadowRoot(): ShadowRoot | null {
  return overlayHost?.shadowRoot ?? null;
}

function updateSearchCountLabel(): void {
  const shadowRoot = getOverlayShadowRoot();
  const label = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_COUNT_ID);
  if (!(label instanceof HTMLElement)) {
    return;
  }

  const total = searchResults.length;
  if (total === 0) {
    label.textContent = '0 results';
    return;
  }

  label.textContent = `${activeSearchResultIndex + 1} / ${total}`;
}

function clearSearchHighlights(): void {
  const shadowRoot = getOverlayShadowRoot();
  if (!shadowRoot) {
    return;
  }

  const marks = Array.from(shadowRoot.querySelectorAll('mark.skill-hunter-search-hit'));
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }

    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });

  searchResults = [];
  activeSearchResultIndex = -1;
  updateSearchCountLabel();
}

function highlightSearchMatches(query: string): void {
  clearSearchHighlights();

  const shadowRoot = getOverlayShadowRoot();
  const container = shadowRoot?.getElementById(SKILL_HUNTER_IDS.MAIN_CONTENT_ID);
  if (!(container instanceof HTMLElement) || !query.trim()) {
    return;
  }

  const escapedQuery = escapeRegExp(query.trim());
  const regex = new RegExp(escapedQuery, 'gi');
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent) {
      continue;
    }

    if (parent.closest('mark.skill-hunter-search-hit')) {
      continue;
    }

    if (!node.textContent?.trim()) {
      continue;
    }

    textNodes.push(node);
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent ?? '';
    regex.lastIndex = 0;

    if (!regex.test(text)) {
      return;
    }

    const fragment = document.createDocumentFragment();
    regex.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const [matchedText] = match;
      const startIndex = match.index;
      if (startIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
      }

      const mark = document.createElement('mark');
      mark.className = 'skill-hunter-search-hit';
      mark.textContent = matchedText;
      fragment.appendChild(mark);
      searchResults.push(mark);
      lastIndex = startIndex + matchedText.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  if (searchResults.length > 0) {
    activeSearchResultIndex = 0;
    moveToSearchResult(activeSearchResultIndex);
  }

  updateSearchCountLabel();
}

function moveToSearchResult(nextIndex: number): void {
  if (searchResults.length === 0) {
    return;
  }

  const normalizedIndex = ((nextIndex % searchResults.length) + searchResults.length) % searchResults.length;
  activeSearchResultIndex = normalizedIndex;

  searchResults.forEach((result, index) => {
    result.classList.toggle('search-hit-active', index === activeSearchResultIndex);
  });

  const target = searchResults[activeSearchResultIndex];
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateSearchCountLabel();
}

function showToast(message: string): void {
  const shadowRoot = getOverlayShadowRoot();
  const toast = shadowRoot?.getElementById(SKILL_HUNTER_IDS.TOAST_ID);
  if (!(toast instanceof HTMLElement)) {
    return;
  }

  toast.textContent = message;
  toast.classList.add('visible');

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}

function getMainContentElement(): HTMLElement | null {
  const shadowRoot = getOverlayShadowRoot();
  const main = shadowRoot?.getElementById(SKILL_HUNTER_IDS.MAIN_CONTENT_ID);
  return main instanceof HTMLElement ? main : null;
}

function getNearestHeadingForCitation(): HTMLElement | null {
  const mainContent = getMainContentElement();
  if (!mainContent) {
    return null;
  }

  const headings = Array.from(mainContent.querySelectorAll<HTMLElement>('h2.section-header, h3.provision-header'));
  if (headings.length === 0) {
    return null;
  }

  const currentOffset = mainContent.scrollTop + 40;
  let nearest: HTMLElement | null = headings[0] ?? null;

  headings.forEach((heading) => {
    if (heading.offsetTop <= currentOffset) {
      nearest = heading;
    }
  });

  return nearest;
}

async function copyCitation(): Promise<void> {
  const heading = getNearestHeadingForCitation();
  if (!heading) {
    showToast('No section heading available to cite.');
    return;
  }

  const headingId = heading.id ? `#${heading.id}` : '';
  const citationUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${headingId}`;
  const citationText = `${statuteTitle} | ${heading.textContent?.trim() || 'Section'} | ${citationUrl}`;

  const copied = await copyTextToClipboard(citationText);
  showToast(copied ? 'Citation copied.' : 'Failed to copy citation.');
}

async function copyCurrentPageLink(): Promise<void> {
  const copied = await copyTextToClipboard(window.location.href);
  showToast(copied ? 'Page link copied.' : 'Failed to copy page link.');
}

function updateNoteStatus(message: string, isError = false): void {
  const shadowRoot = getOverlayShadowRoot();
  const statusEl = shadowRoot?.getElementById(SKILL_HUNTER_IDS.NOTE_STATUS_ID);
  if (!(statusEl instanceof HTMLElement)) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.toggle('note-status-error', isError);
}

function updateNoteCounter(): void {
  const shadowRoot = getOverlayShadowRoot();
  const textarea = shadowRoot?.getElementById(SKILL_HUNTER_IDS.NOTE_TEXTAREA_ID);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const counter = shadowRoot.querySelector('.note-counter');
  if (counter instanceof HTMLElement) {
    counter.textContent = `${textarea.value.length}/${UX_LIMITS.NOTE_MAX_CHARACTERS}`;
  }
}

async function persistCurrentNote(): Promise<void> {
  const shadowRoot = getOverlayShadowRoot();
  const textarea = shadowRoot?.getElementById(SKILL_HUNTER_IDS.NOTE_TEXTAREA_ID);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  noteDraft = textarea.value;
  const noteRecord: LegislationNote = {
    statuteKey,
    statuteTitle,
    statuteUrl: window.location.href,
    note: noteDraft,
    updatedAt: new Date().toISOString(),
  };

  const saved = await saveLegislationNote(noteRecord);
  updateNoteStatus(saved ? `Saved ${new Date().toLocaleTimeString()}` : 'Save failed', !saved);
}

function scheduleNoteSave(): void {
  if (noteSaveTimeoutId) {
    window.clearTimeout(noteSaveTimeoutId);
  }

  noteSaveTimeoutId = window.setTimeout(() => {
    void persistCurrentNote();
  }, 450);
}

async function initializeNotePanel(): Promise<void> {
  const shadowRoot = getOverlayShadowRoot();
  const textarea = shadowRoot?.getElementById(SKILL_HUNTER_IDS.NOTE_TEXTAREA_ID);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const existingNote = await readLegislationNote(statuteKey);
  if (existingNote?.note) {
    noteDraft = existingNote.note;
    textarea.value = existingNote.note;
    updateNoteStatus(`Last saved ${new Date(existingNote.updatedAt).toLocaleString()}`);
  } else {
    updateNoteStatus('No note saved yet.');
  }

  updateNoteCounter();

  textarea.addEventListener('input', () => {
    noteDraft = textarea.value;
    updateNoteCounter();
    updateNoteStatus('Saving...');
    scheduleNoteSave();
  });
}

async function exportCurrentNote(): Promise<void> {
  const note: LegislationNote = {
    statuteKey,
    statuteTitle,
    statuteUrl: window.location.href,
    note: noteDraft,
    updatedAt: new Date().toISOString(),
  };

  const markdown = exportLegislationNoteAsMarkdown(note);
  const copied = await copyTextToClipboard(markdown);
  showToast(copied ? 'Notes exported to clipboard.' : 'Failed to export notes.');
}

function handleOverlayClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element) || !overlayHost?.shadowRoot) {
    return;
  }

  const actionElement = target.closest<HTMLElement>(`[${SKILL_HUNTER_IDS.ACTION_ATTR}]`);
  const action = actionElement?.dataset.skillHunterAction;

  if (action === 'close') {
    revertPage();
    return;
  }

  if (action === 'search-prev') {
    moveToSearchResult(activeSearchResultIndex - 1);
    return;
  }

  if (action === 'search-next') {
    moveToSearchResult(activeSearchResultIndex + 1);
    return;
  }

  if (action === 'copy-citation') {
    void copyCitation();
    return;
  }

  if (action === 'copy-link') {
    void copyCurrentPageLink();
    return;
  }

  if (action === 'export-note') {
    void exportCurrentNote();
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

function registerSearchEvents(): void {
  const shadowRoot = getOverlayShadowRoot();
  const searchInput = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_INPUT_ID);

  if (!(searchInput instanceof HTMLInputElement)) {
    contentLogger.warn('Search input missing from overlay');
    return;
  }

  searchInput.addEventListener('input', () => {
    highlightSearchMatches(searchInput.value);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      moveToSearchResult(activeSearchResultIndex - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      moveToSearchResult(activeSearchResultIndex + 1);
    }
  });
}

function handleOverlayKeydown(event: KeyboardEvent): void {
  if (!isSimplified || !overlayHost?.shadowRoot) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    const searchInput = overlayHost.shadowRoot.getElementById(SKILL_HUNTER_IDS.SEARCH_INPUT_ID);
    if (searchInput instanceof HTMLInputElement) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    return;
  }

  if (event.key === 'Escape') {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      return;
    }

    event.preventDefault();
    revertPage();
  }
}

function registerGlobalErrorListeners(): void {
  if (errorListenersRegistered) {
    return;
  }

  window.addEventListener('error', (event) => {
    contentLogger.error('Unhandled runtime error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    contentLogger.error('Unhandled promise rejection', { reason: event.reason });
  });

  errorListenersRegistered = true;
}

function simplifyPage(): void {
  if (isSimplified) {
    return;
  }

  contentLogger.info('Simplifying page');
  originalDocumentTitle = document.title;
  originalDocumentOverflow = document.documentElement.style.overflow;

  statuteKey = createStatuteKeyFromUrl(window.location.href);

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

  registerSearchEvents();
  void initializeNotePanel();
  window.addEventListener('keydown', handleOverlayKeydown);

  contentLogger.info('Page simplified successfully');
}

function revertPage(): void {
  if (!isSimplified || !overlayHost) {
    return;
  }

  contentLogger.info('Reverting page');

  overlayHost.remove();
  overlayHost = null;
  document.documentElement.style.overflow = originalDocumentOverflow;
  document.title = originalDocumentTitle;

  if (noteSaveTimeoutId) {
    window.clearTimeout(noteSaveTimeoutId);
    noteSaveTimeoutId = null;
  }

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }

  window.removeEventListener('keydown', handleOverlayKeydown);

  searchResults = [];
  activeSearchResultIndex = -1;
  isSimplified = false;

  contentLogger.info('Page reverted successfully');
}

function resolveUserFacingMessage(
  normalizedError: NormalizedError,
  fallbackMessage: string
): string {
  return getUserFacingErrorMessage(normalizedError, fallbackMessage);
}

function checkSupportedPage(): ChromeMessageResponse {
  return {
    status: 'success',
    supportedPage: isWholeDocumentView(),
  };
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
    const normalized = handleError(error, 'toggleSimplifiedView');
    return {
      status: 'error',
      error: resolveUserFacingMessage(normalized, 'Skill Hunter could not simplify this page.'),
    };
  }
}

function handleMessage(
  message: ChromeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ChromeMessageResponse) => void
): boolean {
  contentLogger.debug('Message received', message);

  if (message.action === 'toggle_simplified_view') {
    sendResponse(toggleSimplifiedView());
    return false;
  }

  if (message.action === 'check_supported_page') {
    sendResponse(checkSupportedPage());
    return false;
  }

  sendResponse({ status: 'error', error: 'Unknown action' });
  return false;
}

function initialize(): void {
  registerGlobalErrorListeners();
  contentLogger.info('Skill Hunter content script initialized');
  chrome.runtime.onMessage.addListener(handleMessage);
}

initialize();
