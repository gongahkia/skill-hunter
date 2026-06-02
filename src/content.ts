/**
 * Content script - Main entry point for the browser extension
 */

import type {
  ChromeMessage,
  ChromeMessageResponse,
  CitationFormat,
  HTMLContent,
  LegislationMetadata,
  LegislationNote,
  PageSummary,
  StatuteType,
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
import { injectCitationPanels } from '@/core/citationGraphPanel';
import { extractActSlugFromUrl, loadCitationIndex } from '@/utils/citationIndex';
import { SIDEBAR_STORAGE_KEYS, SKILL_HUNTER_IDS, UX_LIMITS } from '@/utils/constants';
import { getUserFacingErrorMessage, handleError } from '@/utils/errorHandler';
import type { NormalizedError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';
import {
  buildRevisionUrl,
  copyTextToClipboard,
  createStatuteKeyFromUrl,
  exportLegislationNoteAsMarkdown,
  formatCitation,
  formatDiagnosticsReport,
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
  const timelineHTML = generateTimelinePanelHTML(legislationMetadata);

  return {
    title: `Skill Hunter: ${pageBasicData.legislationTitle}`,
    content: `
      <div class="skill-hunter-root">
        <div class="skill-hunter-toolbar">
          <div class="skill-hunter-toolbar-title">
            <h1 id="${SKILL_HUNTER_IDS.STATUTE_TITLE_ID}" class="skill-hunter-statute-title" title="${escapeAttr(statuteTitle)}">${escapeHtml(statuteTitle)}</h1>
          </div>
          <div class="skill-hunter-toolbar-actions">
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.TOC_TOGGLE_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="toggle-toc" title="Toggle table of contents" aria-label="Toggle table of contents">
              ${ICONS.panelLeft}
            </button>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.NOTES_TOGGLE_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="toggle-notes" title="Toggle research notes" aria-label="Toggle research notes">
              ${ICONS.panelRight}
            </button>
            <span class="toolbar-divider" aria-hidden="true"></span>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.SEARCH_TOGGLE_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="toggle-search" title="Search (⌘F)" aria-label="Search">
              ${ICONS.search}
            </button>
            <select id="${SKILL_HUNTER_IDS.CITATION_FORMAT_ID}" class="citation-format-select" title="Citation format" aria-label="Citation format">
              <option value="default">Default</option>
              <option value="bluebook">Bluebook</option>
              <option value="oscola">OSCOLA</option>
            </select>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.COPY_CITATION_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="copy-citation" title="Copy citation" aria-label="Copy citation">
              ${ICONS.quote}
            </button>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.COPY_LINK_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="copy-link" title="Copy page link" aria-label="Copy page link">
              ${ICONS.link}
            </button>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.EXPORT_NOTE_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="export-note" title="Export notes" aria-label="Export notes">
              ${ICONS.download}
            </button>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.TIMELINE_BTN_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="toggle-timeline" title="Timeline" aria-label="Timeline">
              ${ICONS.clock}
            </button>
            <button class="icon-btn" type="button" id="${SKILL_HUNTER_IDS.EXPORT_DIAGNOSTICS_ID}" ${SKILL_HUNTER_IDS.ACTION_ATTR}="export-diagnostics" title="Export diagnostics" aria-label="Export diagnostics">
              ${ICONS.bug}
            </button>
            <span class="toolbar-divider" aria-hidden="true"></span>
            <button class="icon-btn icon-btn-close" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="close" title="Close (Esc)" aria-label="Close">
              ${ICONS.close}
            </button>
          </div>
        </div>
        <div class="skill-hunter-layout">
          ${tocHTML}
          <main id="${SKILL_HUNTER_IDS.MAIN_CONTENT_ID}" class="main-content" aria-label="Simplified legislation">
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
        <div id="${SKILL_HUNTER_IDS.SEARCH_BAR_ID}" class="skill-hunter-search-bar" role="search" aria-label="Search within this statute" hidden>
          <input
            id="${SKILL_HUNTER_IDS.SEARCH_INPUT_ID}"
            class="search-input"
            type="search"
            placeholder="Find in statute"
            maxlength="${UX_LIMITS.SEARCH_QUERY_MAX_CHARACTERS}"
            autocomplete="off"
          />
          <span id="${SKILL_HUNTER_IDS.SEARCH_COUNT_ID}" class="search-count" aria-live="polite">0/0</span>
          <span class="search-divider" aria-hidden="true"></span>
          <button id="${SKILL_HUNTER_IDS.SEARCH_PREV_ID}" class="search-icon-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="search-prev" title="Previous match" aria-label="Previous match">${ICONS.chevronUp}</button>
          <button id="${SKILL_HUNTER_IDS.SEARCH_NEXT_ID}" class="search-icon-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="search-next" title="Next match" aria-label="Next match">${ICONS.chevronDown}</button>
          <button id="${SKILL_HUNTER_IDS.SEARCH_CLOSE_ID}" class="search-icon-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="search-close" title="Close (Esc)" aria-label="Close search">${ICONS.close}</button>
        </div>
        <div id="${SKILL_HUNTER_IDS.TOOLTIP_ID}" class="skill-hunter-tooltip" role="tooltip" aria-hidden="true"></div>
        <div id="${SKILL_HUNTER_IDS.TOAST_ID}" class="skill-hunter-toast" role="status" aria-live="polite"></div>
        ${timelineHTML}
      </div>
    `,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const ICONS = {
  panelLeft:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/></svg>',
  panelRight:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M12 4v12"/></svg>',
  search:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="5.2"/><path d="M13 13l3.5 3.5"/></svg>',
  quote:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13c-1 0-2-1-2-2.5C3 8 4.5 6 7 5"/><path d="M13 13c-1 0-2-1-2-2.5 0-2.5 1.5-4.5 4-5.5"/></svg>',
  link: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 11.5l3-3"/><path d="M11.5 6.5L13 5a3 3 0 014.2 4.2L15.5 11"/><path d="M8.5 13.5L7 15a3 3 0 01-4.2-4.2L4.5 9"/></svg>',
  download:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10"/><path d="M5.5 9l4.5 4.5L14.5 9"/><path d="M3.5 16.5h13"/></svg>',
  clock:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/></svg>',
  bug: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="9" rx="4"/><path d="M3 8h3M14 8h3M3 12h3M14 12h3M3 16h3M14 16h3M8 5l-1-2M12 5l1-2"/></svg>',
  close:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  chevronUp:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l5-5 5 5"/></svg>',
  chevronDown:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5l5 5 5-5"/></svg>',
};

function getOverlayShadowRoot(): ShadowRoot | null {
  return overlayHost?.shadowRoot ?? null;
}

function updateSearchCountLabel(capped: boolean = false): void {
  const shadowRoot = getOverlayShadowRoot();
  const label = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_COUNT_ID);
  if (!(label instanceof HTMLElement)) {
    return;
  }

  const total = searchResults.length;
  label.classList.toggle('search-count-empty', total === 0);
  if (total === 0) {
    label.textContent = '0/0';
    return;
  }
  const suffix = capped ? '+' : '';
  label.textContent = `${activeSearchResultIndex + 1}/${total}${suffix}`;
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

const SEARCH_MAX_MATCHES = 2000;
const SEARCH_MIN_QUERY_LENGTH = 2;
let cachedSearchTextNodes: Text[] | null = null;

function getSearchableTextNodes(container: HTMLElement): Text[] {
  if (cachedSearchTextNodes) return cachedSearchTextNodes;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent) continue;
    // Skip empty / whitespace-only nodes and anything inside an existing mark.
    if (!node.textContent?.trim()) continue;
    out.push(node);
  }
  cachedSearchTextNodes = out;
  return out;
}

function highlightSearchMatches(query: string): void {
  clearSearchHighlights();

  const shadowRoot = getOverlayShadowRoot();
  const container = shadowRoot?.getElementById(SKILL_HUNTER_IDS.MAIN_CONTENT_ID);
  if (!(container instanceof HTMLElement)) return;

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
    updateSearchCountLabel();
    return;
  }

  // Cache text nodes once per simplified-view lifecycle. Subsequent searches
  // skip the tree walk entirely.
  const textNodes = getSearchableTextNodes(container);
  const escapedQuery = escapeRegExp(trimmedQuery);
  const regex = new RegExp(escapedQuery, 'gi');

  let totalMatches = 0;
  let capped = false;

  for (const textNode of textNodes) {
    if (capped) break;
    if (!textNode.isConnected) continue; // node may have been spliced by a previous run
    const text = textNode.textContent ?? '';
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;

    const fragment = document.createDocumentFragment();
    regex.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (totalMatches >= SEARCH_MAX_MATCHES) {
        capped = true;
        break;
      }
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
      totalMatches += 1;
      lastIndex = startIndex + matchedText.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  if (searchResults.length > 0) {
    activeSearchResultIndex = 0;
    moveToSearchResult(activeSearchResultIndex);
  }

  updateSearchCountLabel(capped);
  // Splicing the cached text nodes invalidated them — drop the cache so the
  // next clear-and-search rebuild walks a clean tree.
  cachedSearchTextNodes = null;
}

function moveToSearchResult(nextIndex: number): void {
  if (searchResults.length === 0) {
    return;
  }

  const normalizedIndex =
    ((nextIndex % searchResults.length) + searchResults.length) % searchResults.length;
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

  const headings = Array.from(
    mainContent.querySelectorAll<HTMLElement>('h2.section-header, h3.provision-header')
  );
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

function getSelectedCitationFormat(): CitationFormat {
  const shadowRoot = getOverlayShadowRoot();
  const select = shadowRoot?.getElementById(SKILL_HUNTER_IDS.CITATION_FORMAT_ID);
  if (select instanceof HTMLSelectElement) {
    return select.value as CitationFormat;
  }
  return 'default';
}

async function copyCitation(): Promise<void> {
  const heading = getNearestHeadingForCitation();
  if (!heading) {
    showToast('No section heading available to cite.');
    return;
  }

  const headingId = heading.id ? `#${heading.id}` : '';
  const citationUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${headingId}`;
  const sectionHeading = heading.textContent?.trim() || 'Section';
  const format = getSelectedCitationFormat();
  const citationText = formatCitation(format, statuteTitle, sectionHeading, citationUrl);

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
  if (!shadowRoot) {
    return;
  }

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

function generateTimelinePanelHTML(metadata: LegislationMetadata): string {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Legislation', value: metadata.legislationName },
    { label: 'Date', value: metadata.legislationDate },
    { label: 'Revised Title', value: metadata.revisedLegislationName },
    { label: 'Revised Info', value: metadata.revisedLegislationText },
  ].filter((i) => i.value.trim().length > 0);
  const rows = items
    .map(
      (i) =>
        `<div class="timeline-row"><span class="timeline-label">${escapeHtml(i.label)}</span><span class="timeline-value">${escapeHtml(i.value)}</span></div>`
    )
    .join('');
  return `
    <div id="${SKILL_HUNTER_IDS.TIMELINE_PANEL_ID}" class="timeline-panel" aria-label="Revision timeline">
      <h3 class="timeline-title">Revision Timeline</h3>
      ${rows || '<p class="timeline-empty">No revision metadata available.</p>'}
      <div class="timeline-nav">
        <label class="timeline-nav-label" for="skill-hunter-rev-date">Compare revision date</label>
        <input id="skill-hunter-rev-date" class="timeline-date-input" type="date" />
        <button class="toolbar-btn" type="button" ${SKILL_HUNTER_IDS.ACTION_ATTR}="open-revision">Open revision</button>
      </div>
    </div>`;
}

function toggleTimelinePanel(): void {
  const shadowRoot = getOverlayShadowRoot();
  const panel = shadowRoot?.getElementById(SKILL_HUNTER_IDS.TIMELINE_PANEL_ID);
  if (panel instanceof HTMLElement) {
    panel.classList.toggle('visible');
  }
}

function openRevisionDate(): void {
  const shadowRoot = getOverlayShadowRoot();
  const input = shadowRoot?.getElementById('skill-hunter-rev-date');
  if (!(input instanceof HTMLInputElement) || !input.value) {
    showToast('Enter a revision date first.');
    return;
  }
  const formatted = input.value.replace(/-/g, ''); // YYYYMMDD
  const url = buildRevisionUrl(window.location.href, formatted);
  window.open(url, '_blank', 'noopener');
}

async function exportDiagnostics(): Promise<void> {
  const entries = logger.getBufferedEntries();
  const sessionId = logger.getSessionId();
  const report = formatDiagnosticsReport(entries, sessionId);
  const copied = await copyTextToClipboard(report);
  showToast(copied ? `Diagnostics copied (${entries.length} entries).` : 'Failed to export.');
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

  if (action === 'toggle-search') {
    toggleSearchBar();
    return;
  }

  if (action === 'search-close') {
    closeSearchBar();
    return;
  }

  if (action === 'toggle-toc') {
    toggleSidebar('toc');
    return;
  }

  if (action === 'toggle-notes') {
    toggleSidebar('notes');
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

  if (action === 'toggle-timeline') {
    toggleTimelinePanel();
    return;
  }

  if (action === 'open-revision') {
    openRevisionDate();
    return;
  }

  if (action === 'export-diagnostics') {
    void exportDiagnostics();
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

let searchDebounceTimeoutId: number | null = null;

function scheduleSearch(query: string): void {
  if (searchDebounceTimeoutId) {
    window.clearTimeout(searchDebounceTimeoutId);
  }
  searchDebounceTimeoutId = window.setTimeout(() => {
    searchDebounceTimeoutId = null;
    highlightSearchMatches(query);
  }, 180);
}

function registerSearchEvents(): void {
  const shadowRoot = getOverlayShadowRoot();
  const searchInput = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_INPUT_ID);

  if (!(searchInput instanceof HTMLInputElement)) {
    contentLogger.warn('Search input missing from overlay');
    return;
  }

  searchInput.addEventListener('input', () => {
    scheduleSearch(searchInput.value);
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

function openSearchBar(): void {
  const shadowRoot = getOverlayShadowRoot();
  const bar = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_BAR_ID);
  if (!(bar instanceof HTMLElement)) return;
  bar.hidden = false;
  const input = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_INPUT_ID);
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
}

function closeSearchBar(): void {
  const shadowRoot = getOverlayShadowRoot();
  const bar = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_BAR_ID);
  if (bar instanceof HTMLElement) {
    bar.hidden = true;
  }
  const input = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_INPUT_ID);
  if (input instanceof HTMLInputElement) {
    input.value = '';
  }
  clearSearchHighlights();
  if (searchDebounceTimeoutId) {
    window.clearTimeout(searchDebounceTimeoutId);
    searchDebounceTimeoutId = null;
  }
}

function toggleSearchBar(): void {
  const shadowRoot = getOverlayShadowRoot();
  const bar = shadowRoot?.getElementById(SKILL_HUNTER_IDS.SEARCH_BAR_ID);
  if (!(bar instanceof HTMLElement)) return;
  if (bar.hidden) {
    openSearchBar();
  } else {
    closeSearchBar();
  }
}

function getRootDiv(): HTMLElement | null {
  const shadowRoot = getOverlayShadowRoot();
  return shadowRoot?.querySelector<HTMLElement>('.skill-hunter-root') ?? null;
}

function toggleSidebar(which: 'toc' | 'notes'): void {
  const root = getRootDiv();
  if (!root) return;
  const className = which === 'toc' ? 'toc-collapsed' : 'notes-collapsed';
  const collapsed = root.classList.toggle(className);
  const buttonId =
    which === 'toc' ? SKILL_HUNTER_IDS.TOC_TOGGLE_ID : SKILL_HUNTER_IDS.NOTES_TOGGLE_ID;
  const shadowRoot = getOverlayShadowRoot();
  const btn = shadowRoot?.getElementById(buttonId);
  if (btn instanceof HTMLElement) {
    btn.classList.toggle('icon-btn-active', !collapsed);
  }
  void persistSidebarState(which, collapsed);
}

async function persistSidebarState(which: 'toc' | 'notes', collapsed: boolean): Promise<void> {
  try {
    const key =
      which === 'toc' ? SIDEBAR_STORAGE_KEYS.TOC_COLLAPSED : SIDEBAR_STORAGE_KEYS.NOTES_COLLAPSED;
    await chrome.storage.local.set({ [key]: collapsed });
  } catch (error) {
    contentLogger.warn('Failed to persist sidebar state', { which, error });
  }
}

async function loadSidebarState(): Promise<void> {
  try {
    const {
      [SIDEBAR_STORAGE_KEYS.TOC_COLLAPSED]: tocCollapsed,
      [SIDEBAR_STORAGE_KEYS.NOTES_COLLAPSED]: notesCollapsed,
    } = await chrome.storage.local.get([
      SIDEBAR_STORAGE_KEYS.TOC_COLLAPSED,
      SIDEBAR_STORAGE_KEYS.NOTES_COLLAPSED,
    ]);
    const root = getRootDiv();
    const shadowRoot = getOverlayShadowRoot();
    if (root && Boolean(tocCollapsed)) {
      root.classList.add('toc-collapsed');
    }
    if (root && Boolean(notesCollapsed)) {
      root.classList.add('notes-collapsed');
    }
    const tocBtn = shadowRoot?.getElementById(SKILL_HUNTER_IDS.TOC_TOGGLE_ID);
    if (tocBtn instanceof HTMLElement) {
      tocBtn.classList.toggle('icon-btn-active', !tocCollapsed);
    }
    const notesBtn = shadowRoot?.getElementById(SKILL_HUNTER_IDS.NOTES_TOGGLE_ID);
    if (notesBtn instanceof HTMLElement) {
      notesBtn.classList.toggle('icon-btn-active', !notesCollapsed);
    }
  } catch (error) {
    contentLogger.warn('Failed to load sidebar state', { error });
  }
}

function handleOverlayKeydown(event: KeyboardEvent): void {
  if (!isSimplified || !overlayHost?.shadowRoot) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    openSearchBar();
    return;
  }

  if (event.key === 'Escape') {
    // Search open → close search instead of overlay.
    const searchBar = overlayHost.shadowRoot.getElementById(SKILL_HUNTER_IDS.SEARCH_BAR_ID);
    if (searchBar instanceof HTMLElement && !searchBar.hidden) {
      event.preventDefault();
      closeSearchBar();
      return;
    }

    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
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
      error: event.error as unknown,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    contentLogger.error('Unhandled promise rejection', { reason: event.reason as unknown });
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

  // append fragment directly so .skill-hunter-root is a direct shadow child;
  // an extra wrapper <div> breaks the height: 100% cascade and lets the
  // flex root grow to content height, killing scroll.
  shadowRoot.append(styleEl, createMarkupFragment(simplifiedContent.content));
  const rootDiv = shadowRoot.querySelector<HTMLElement>('.skill-hunter-root');
  rootDiv?.addEventListener('click', handleOverlayClick);

  document.body.appendChild(host);
  document.documentElement.style.overflow = 'hidden';
  document.title = simplifiedContent.title;

  overlayHost = host;
  isSimplified = true;

  registerSearchEvents();
  void initializeNotePanel();
  void initializeCitationGraph();
  registerStatuteTermSingleton();
  initializeTocScrollSpy();
  void loadSidebarState();
  window.addEventListener('keydown', handleOverlayKeydown);

  contentLogger.info('Page simplified successfully');
}

let activeStatuteTerm: HTMLElement | null = null;
let statuteTermShowTimeoutId: number | null = null;
let statuteTermHideTimeoutId: number | null = null;
let tocSpyCleanup: (() => void) | null = null;

function getTooltipElement(): HTMLElement | null {
  const shadowRoot = getOverlayShadowRoot();
  const el = shadowRoot?.getElementById(SKILL_HUNTER_IDS.TOOLTIP_ID);
  return el instanceof HTMLElement ? el : null;
}

function hideTooltip(): void {
  const tooltip = getTooltipElement();
  if (tooltip) {
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }
  if (activeStatuteTerm) {
    activeStatuteTerm.classList.remove('statute-term-active');
    activeStatuteTerm = null;
  }
}

function showTooltipForTerm(term: HTMLElement): void {
  const tooltip = getTooltipElement();
  if (!tooltip) return;

  const text = term.getAttribute(SKILL_HUNTER_IDS.TOOLTIP_ATTR);
  if (!text) return;

  if (activeStatuteTerm && activeStatuteTerm !== term) {
    activeStatuteTerm.classList.remove('statute-term-active');
  }
  activeStatuteTerm = term;
  term.classList.add('statute-term-active');

  tooltip.textContent = text;
  tooltip.setAttribute('aria-hidden', 'false');

  // Position relative to viewport (position: fixed in CSS). Place above the
  // term by default, flip below if it would clip the top of the viewport, and
  // clamp horizontally so it never overflows past either sidebar.
  tooltip.classList.add('visible');
  // Measure after making it visible so width is accurate.
  const termRect = term.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const viewportW = document.documentElement.clientWidth;
  const margin = 12;

  let left = termRect.left + termRect.width / 2 - tipRect.width / 2;
  left = Math.max(margin, Math.min(left, viewportW - tipRect.width - margin));

  let top = termRect.top - tipRect.height - 8;
  if (top < margin) {
    // Not enough room above — flip below.
    top = termRect.bottom + 8;
  }

  tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function registerStatuteTermSingleton(): void {
  const shadowRoot = getOverlayShadowRoot();
  if (!shadowRoot) return;

  const onEnter = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const term = target.closest<HTMLElement>('.statute-term');
    if (!term) return;
    if (statuteTermHideTimeoutId) {
      window.clearTimeout(statuteTermHideTimeoutId);
      statuteTermHideTimeoutId = null;
    }
    if (statuteTermShowTimeoutId) {
      window.clearTimeout(statuteTermShowTimeoutId);
    }
    statuteTermShowTimeoutId = window.setTimeout(() => {
      showTooltipForTerm(term);
    }, 80);
  };

  const onLeave = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.statute-term')) return;
    if (statuteTermShowTimeoutId) {
      window.clearTimeout(statuteTermShowTimeoutId);
      statuteTermShowTimeoutId = null;
    }
    if (statuteTermHideTimeoutId) {
      window.clearTimeout(statuteTermHideTimeoutId);
    }
    statuteTermHideTimeoutId = window.setTimeout(() => {
      hideTooltip();
    }, 120);
  };

  shadowRoot.addEventListener('mouseover', onEnter, true);
  shadowRoot.addEventListener('mouseout', onLeave, true);

  // Hide tooltip on scroll — easier than tracking and repositioning.
  const mainContent = getMainContentElement();
  if (mainContent) mainContent.addEventListener('scroll', hideTooltip, { passive: true });
  const layout = shadowRoot.querySelector<HTMLElement>('.skill-hunter-layout');
  if (layout && layout !== mainContent)
    layout.addEventListener('scroll', hideTooltip, { passive: true });
}

function initializeTocScrollSpy(): void {
  const shadowRoot = getOverlayShadowRoot();
  if (!shadowRoot) return;

  const mainContent = getMainContentElement();
  const tocContainer = shadowRoot.querySelector<HTMLElement>('.toc-container');
  if (!mainContent || !tocContainer) return;

  const headers = Array.from(mainContent.querySelectorAll<HTMLElement>('h2.section-header[id]'));
  if (headers.length === 0) return;

  // headerId → TOC button reference; some buttons may be disabled (no target).
  const tocButtons = Array.from(
    tocContainer.querySelectorAll<HTMLElement>(`[${SKILL_HUNTER_IDS.TOC_TARGET_ATTR}]`)
  );
  const buttonByTargetId = new Map<string, HTMLElement>();
  for (const btn of tocButtons) {
    const targetId = btn.dataset.skillHunterScrollTarget;
    if (targetId) buttonByTargetId.set(targetId, btn);
  }

  let activeTargetId: string | null = null;

  const scrollContainer = (): HTMLElement => {
    // Narrow viewport: .skill-hunter-layout owns vertical scroll; otherwise .main-content.
    const layout = shadowRoot.querySelector<HTMLElement>('.skill-hunter-layout');
    if (layout && getComputedStyle(layout).overflowY === 'auto') return layout;
    return mainContent;
  };

  const updateActive = (): void => {
    const container = scrollContainer();
    const containerTop = container.getBoundingClientRect().top;
    const threshold = containerTop + 80; // dead zone for toolbar/sticky chrome

    let candidate: HTMLElement | null = null;
    for (const header of headers) {
      const top = header.getBoundingClientRect().top;
      if (top <= threshold) {
        candidate = header;
      } else {
        break;
      }
    }
    if (!candidate) candidate = headers[0] ?? null;
    if (!candidate) return;

    const targetId = candidate.id;
    if (targetId === activeTargetId) return;
    activeTargetId = targetId;

    for (const btn of tocButtons) {
      btn.classList.remove('toc-link-active');
    }
    const activeBtn = buttonByTargetId.get(targetId);
    if (!activeBtn) return;
    activeBtn.classList.add('toc-link-active');

    // Scroll TOC sidebar to keep the active item visible.
    const item = activeBtn.closest<HTMLElement>('.toc-item') ?? activeBtn;
    const itemRect = item.getBoundingClientRect();
    const tocRect = tocContainer.getBoundingClientRect();
    if (itemRect.top < tocRect.top + 40 || itemRect.bottom > tocRect.bottom - 40) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  let rafId = 0;
  const onScroll = (): void => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateActive();
    });
  };

  const containerInitial = scrollContainer();
  containerInitial.addEventListener('scroll', onScroll, { passive: true });
  // The other potential scroll container needs the listener too in case the
  // viewport crosses the breakpoint while open.
  const layout = shadowRoot.querySelector<HTMLElement>('.skill-hunter-layout');
  if (layout && layout !== containerInitial) {
    layout.addEventListener('scroll', onScroll, { passive: true });
  }
  if (mainContent !== containerInitial) {
    mainContent.addEventListener('scroll', onScroll, { passive: true });
  }

  updateActive();

  tocSpyCleanup = (): void => {
    if (rafId) window.cancelAnimationFrame(rafId);
    containerInitial.removeEventListener('scroll', onScroll);
    if (layout) layout.removeEventListener('scroll', onScroll);
    mainContent.removeEventListener('scroll', onScroll);
    tocSpyCleanup = null;
  };
}

async function initializeCitationGraph(): Promise<void> {
  const mainContent = getMainContentElement();
  if (!mainContent) return;
  const actSlug = extractActSlugFromUrl(window.location.href);
  if (!actSlug) return;
  const index = await loadCitationIndex(actSlug);
  if (!index) return;
  const decorated = injectCitationPanels(mainContent, index);
  if (decorated > 0) {
    contentLogger.info('Citation graph panels injected', { actSlug, decorated });
  }
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

  if (statuteTermShowTimeoutId) {
    window.clearTimeout(statuteTermShowTimeoutId);
    statuteTermShowTimeoutId = null;
  }
  if (statuteTermHideTimeoutId) {
    window.clearTimeout(statuteTermHideTimeoutId);
    statuteTermHideTimeoutId = null;
  }
  activeStatuteTerm = null;

  if (tocSpyCleanup) {
    tocSpyCleanup();
  }

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

function inferStatuteType(url: string): StatuteType {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'sso.agc.gov.sg') return 'Unknown';
    const path = parsed.pathname;
    if (path.startsWith('/Act')) return 'Act';
    if (path.startsWith('/SL')) return 'Subsidiary Legislation';
    if (path.startsWith('/Bills-Supp')) return 'Supplement';
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function getPageSummary(): Promise<ChromeMessageResponse> {
  try {
    const url = window.location.href;
    const { pageBasicData } = getPageBasicData();
    const legislationMetadata = getLegislationMetadata();
    const actSlug = extractActSlugFromUrl(url);

    let citationCount = 0;
    if (actSlug) {
      const index = await loadCitationIndex(actSlug);
      if (index) {
        for (const entries of Object.values(index.sections)) {
          citationCount += Array.isArray(entries) ? entries.length : 0;
        }
      }
    }

    const summary: PageSummary = {
      title: pageBasicData.legislationTitle || 'Untitled Legislation',
      type: inferStatuteType(url),
      status: pageBasicData.legislationStatus,
      date: legislationMetadata.legislationDate,
      revisedTitle: legislationMetadata.revisedLegislationName,
      hasPdf: Boolean(pageBasicData.legislationPDFDownloadLink),
      sourceUrl: url,
      actSlug,
      citationCount,
    };
    return { status: 'success', pageSummary: summary };
  } catch (error) {
    const normalized = handleError(error, 'getPageSummary');
    return {
      status: 'error',
      error: resolveUserFacingMessage(normalized, 'Failed to read page metadata.'),
    };
  }
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

  if (message.action === 'get_page_summary') {
    void getPageSummary().then(sendResponse);
    return true; // async response
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
