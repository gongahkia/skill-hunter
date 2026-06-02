/**
 * Citation-graph side panel. Issue #3 — for each section heading in the simplified
 * view, inject a collapsible <details> panel listing top-N cases that cite it,
 * pulled from the bundled offline-built citation index.
 */

import type { CitationEntry, CitationIndex } from '@/types';
import { CITATION_TOP_N, SKILL_HUNTER_IDS } from '@/utils/constants';
import { getTopCasesForSection } from '@/utils/citationIndex';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(text: string): string {
  return escapeHtml(text);
}

/**
 * Render a single citation entry as an <li>.
 */
export function renderCitationListItem(entry: CitationEntry): string {
  const url = entry.url ? escapeAttribute(entry.url) : '';
  const titleHtml = entry.title
    ? `<span class="citation-title">${escapeHtml(entry.title)}</span>`
    : '';
  const meta = [entry.citation, entry.year ? String(entry.year) : '', entry.court]
    .filter((part) => part && part.trim().length > 0)
    .map((part) => escapeHtml(part.trim()))
    .join(' · ');
  const metaHtml = meta ? `<span class="citation-meta">${meta}</span>` : '';
  const snippetHtml = entry.snippet
    ? `<span class="citation-snippet">${escapeHtml(entry.snippet)}</span>`
    : '';
  const linkOpen = url
    ? `<a class="citation-link" href="${url}" target="_blank" rel="noopener noreferrer">`
    : '';
  const linkClose = url ? '</a>' : '';
  return `<li class="citation-entry">${linkOpen}${titleHtml}${metaHtml}${linkClose}${snippetHtml}</li>`;
}

/**
 * Build the inner HTML of a citation panel for a given section.
 */
export function renderCitationPanelHTML(sectionId: string, entries: CitationEntry[]): string {
  if (entries.length === 0) return '';
  const items = entries.map(renderCitationListItem).join('');
  return (
    `<details class="${SKILL_HUNTER_IDS.CITATION_PANEL_CLASS}" ` +
    `${SKILL_HUNTER_IDS.CITATION_SECTION_ATTR}="${escapeAttribute(sectionId)}">` +
    `<summary class="citation-summary">` +
    `<span class="citation-summary-label">Cases citing this section</span>` +
    `<span class="citation-summary-count">${entries.length}</span>` +
    `</summary>` +
    `<ul class="citation-list">${items}</ul>` +
    `</details>`
  );
}

/**
 * Walk the rendered main-content element, find each section header, and inject a
 * citation panel immediately after it when the bundled index has matching cases.
 *
 * Returns the count of sections decorated.
 */
export function injectCitationPanels(
  mainContent: HTMLElement,
  index: CitationIndex | null,
  topN: number = CITATION_TOP_N
): number {
  if (!index) return 0;
  const headers = mainContent.querySelectorAll<HTMLElement>('h2.section-header[id]');
  let decorated = 0;
  headers.forEach((header) => {
    const sectionId = header.id;
    const entries = getTopCasesForSection(index, sectionId, topN);
    if (entries.length === 0) return;
    const html = renderCitationPanelHTML(sectionId, entries);
    if (!html) return;
    const wrapper = mainContent.ownerDocument.createElement('div');
    wrapper.innerHTML = html;
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    header.insertAdjacentElement('afterend', panel);
    decorated += 1;
  });
  return decorated;
}
