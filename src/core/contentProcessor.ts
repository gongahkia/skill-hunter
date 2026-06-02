/**
 * Content processing utilities for transforming and enhancing legislation content
 */

import type { ContentToken, Definition, LegislationMetadata, PageBasicData } from '@/types';
import { LOGICAL_CONNECTORS, SKILL_HUNTER_IDS } from '@/utils/constants';
import { logger } from '@/utils/logger';

const STATUTE_TERM_TEMPLATE = (match: string, escapedDefinition: string): string =>
  `<span class="statute-term" ${SKILL_HUNTER_IDS.TOOLTIP_ATTR}="${escapedDefinition}">${match}</span>`;

/**
 * Check if a line needs indentation based on its pattern
 */
export function needsIndentation(line: string): boolean {
  const pattern = /^\((?:[a-z]|[1-9][0-9]*)\)\s/;
  return pattern.test(line);
}

/**
 * Format logical connectors by making them bold and italic
 */
export function formatLogicalConnectors(sentence: string): string {
  const regexPattern = new RegExp(`\\b(${LOGICAL_CONNECTORS.join('|')})\\b`, 'gi');
  return sentence.replace(regexPattern, (match) => `<b><i>${match}</i></b>`);
}

/**
 * Sort definitions by term length (longest first) to avoid partial matches
 */
export function sortDefinitionsByLength(definitions: Definition[]): Definition[] {
  return [...definitions].sort((a, b) => {
    const termA = Object.keys(a)[0] || '';
    const termB = Object.keys(b)[0] || '';
    return termB.length - termA.length;
  });
}

/**
 * Escape HTML to prevent XSS and HTML injection
 */
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

function assertNever(value: never): never {
  throw new Error(`Unknown content token type: ${String(value)}`);
}

export function extractReferenceTargetId(referenceUrl: string): string | null {
  try {
    const parsedUrl = new URL(referenceUrl, window.location.href);
    const target = parsedUrl.hash.replace(/^#/, '').trim();
    return target || null;
  } catch {
    logger.warn(`Unable to parse TOC reference URL: ${referenceUrl}`);
    return null;
  }
}

/**
 * Split text into segments, preserving HTML tags
 * Returns array of {text, isTag} objects
 */
function splitPreservingTags(html: string): Array<{ text: string; isTag: boolean }> {
  const segments: Array<{ text: string; isTag: boolean }> = [];
  const tagRegex = /<[^>]+>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    // Add text before tag
    if (match.index > lastIndex) {
      segments.push({
        text: html.substring(lastIndex, match.index),
        isTag: false,
      });
    }
    // Add tag
    segments.push({
      text: match[0],
      isTag: true,
    });
    lastIndex = tagRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < html.length) {
    segments.push({
      text: html.substring(lastIndex),
      isTag: false,
    });
  }

  return segments;
}

/**
 * Integrate definitions into content tokens with proper HTML handling
 * This modifies the content tokens in place for better performance
 */
export function integrateDefinitions(
  contentTokens: ContentToken[],
  definitions: Definition[]
): void {
  if (definitions.length === 0) {
    logger.debug('No definitions to integrate');
    return;
  }

  // Sort definitions by length to prevent partial matches
  const sortedDefinitions = sortDefinitionsByLength(definitions);

  // Only process section body tokens
  const sectionBodyTokens = contentTokens.filter((token) => token.type === 'sectionBody');

  logger.debug(
    `Processing ${sectionBodyTokens.length} section body tokens with ${sortedDefinitions.length} definitions`
  );

  sectionBodyTokens.forEach((token) => {
    const lines = token.content.split('\n');

    const processedLines = lines.map((line) => {
      // Escape source text before injecting Skill Hunter markup.
      const modifiedLine = formatLogicalConnectors(escapeHtml(line));

      // Then, split the line into segments (text and HTML tags)
      const segments = splitPreservingTags(modifiedLine);

      // Process only the text segments (not HTML tags)
      const processedSegments = segments.map((segment) => {
        if (segment.isTag) {
          // Don't process HTML tags
          return segment.text;
        }

        let textSegment = segment.text;

        // Defer placeholder expansion until ALL definitions are processed.
        // Otherwise the second iteration's regex sees the first's expanded
        // tooltip HTML as plain text and matches terms inside it — producing
        // nested .statute-term spans visible inside tooltips.
        const allReplacements = new Map<string, string>();
        let placeholderCounter = 0;

        sortedDefinitions.forEach((definitionPair) => {
          const term = Object.keys(definitionPair)[0];
          if (!term) return;

          const definition = definitionPair[term];
          if (!definition) return;

          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'gi');

          textSegment = textSegment.replace(regex, (match) => {
            const key = `___SH_TERM_${placeholderCounter++}___`;
            // escapeAttribute === escapeHtml; safe in a double-quoted attr.
            const escapedDefinition = escapeAttribute(definition);
            allReplacements.set(key, STATUTE_TERM_TEMPLATE(match, escapedDefinition));
            return key;
          });
        });

        allReplacements.forEach((value, key) => {
          textSegment = textSegment.replace(key, value);
        });

        return textSegment;
      });

      return processedSegments.join('');
    });

    // Update the token content
    token.content = processedLines.join('<br>');
  });
}

export interface CrossRefContext {
  currentSectionId?: string | null;
  sectionPreviews?: Map<string, string>;
}

const SECTION_ID_FROM_HEADER = /^pr(\d+[A-Z]?)-he-/;

/**
 * Pull the bare section number ("12A") out of an SSO anchor id like "pr12A-he-".
 */
function sectionNumberFromAnchorId(anchorId: string | null | undefined): string | null {
  if (!anchorId) return null;
  const match = SECTION_ID_FROM_HEADER.exec(anchorId);
  return match ? (match[1] ?? null) : null;
}

/**
 * Build a map from SSO section anchor id (`pr12-he-`) to a short preview of the
 * section body, used to power hover tooltips on cross-reference links.
 */
export function buildSectionPreviewMap(
  contentTokens: ContentToken[],
  wordLimit: number = 25
): Map<string, string> {
  const previews = new Map<string, string>();
  for (let i = 0; i < contentTokens.length; i++) {
    const token = contentTokens[i];
    if (!token || token.type !== 'sectionHeader' || !token.ID) continue;
    for (let j = i + 1; j < contentTokens.length; j++) {
      const next = contentTokens[j];
      if (!next) continue;
      if (next.type === 'sectionHeader') break;
      if (next.type !== 'sectionBody') continue;
      const words = next.content.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      if (words.length === 0) continue;
      const slice = words.slice(0, wordLimit).join(' ');
      const preview = words.length > wordLimit ? `${slice}…` : slice;
      previews.set(token.ID, preview);
      break;
    }
  }
  return previews;
}

function renderCrossRefButton(
  label: string,
  targetId: string | null,
  preview: string | null
): string {
  const safeLabel = label; // label sourced from already-escaped segment text
  const previewHtml = preview
    ? `<span class="cross-ref-tooltip">${escapeHtml(preview)}</span>`
    : '';
  if (!targetId) {
    return `<button type="button" class="cross-ref cross-ref-unresolved" disabled aria-disabled="true">${safeLabel}${previewHtml}</button>`;
  }
  return `<button type="button" class="cross-ref" data-skill-hunter-scroll-target="${escapeAttribute(targetId)}">${safeLabel}${previewHtml}</button>`;
}

/**
 * Link cross-references in a single text segment (no HTML tags).
 * Returns the rewritten text plus an array of protected button HTML strings
 * keyed by placeholder so subsequent regex passes don't mangle them.
 */
function rewriteCrossRefSegment(text: string, context: CrossRefContext): string {
  const placeholders = new Map<string, string>();
  let counter = 0;

  const protect = (html: string): string => {
    const key = ` CR${counter++} `;
    placeholders.set(key, html);
    return key;
  };

  const previews = context.sectionPreviews;
  const currentSectionId = context.currentSectionId ?? null;

  const resolveSectionTarget = (sectionNum: string): string => `pr${sectionNum}-he-`;
  const previewFor = (anchorId: string | null): string | null =>
    anchorId && previews ? (previews.get(anchorId) ?? null) : null;

  // Pass 1: long-form "section(s) N" with optional sub-parts and ranges.
  // Trailing `\b` omitted on purpose — sub-part suffixes like `(3)(a)` end on `)`
  // which is non-word, so `\b` would refuse to anchor and the match would lose the suffix.
  let working = text.replace(
    /\b(sections?)\s+(\d+[A-Z]?(?:\(\w+\))*)(?:\s+(?:and|to|[-–—])\s+(\d+[A-Z]?(?:\(\w+\))*))?/gi,
    (match, _kw: string, first: string, _second: string | undefined) => {
      const firstNum = first.match(/^\d+[A-Z]?/i)?.[0];
      if (!firstNum) return match;
      const targetId = resolveSectionTarget(firstNum);
      return protect(renderCrossRefButton(match, targetId, previewFor(targetId)));
    }
  );

  // Pass 2: "subsection (N)" / "subsections (N)(M)" — scroll to current section.
  working = working.replace(/\b(subsections?)\s+(\(\w+\)(?:\(\w+\))*)/gi, (match) =>
    protect(renderCrossRefButton(match, currentSectionId, previewFor(currentSectionId)))
  );

  // Pass 3: "paragraph (a)" / "paras 3-5" — scroll to current section, no preview.
  working = working.replace(
    /\b(paragraphs?|paras?\.?)\s+(\(\w+\)|\d+(?:\s*[-–—]\s*\d+)?)/gi,
    (match) => protect(renderCrossRefButton(match, currentSectionId, previewFor(currentSectionId)))
  );

  // Pass 4: bare "s N" / "s. N" — narrower delimiter context to avoid false hits like "his 5".
  working = working.replace(
    /(^|[\s(,;:])(s\.?)\s+(\d+[A-Z]?)(?=[\s,.;:)\]]|$)/gi,
    (_match, lead: string, _kw: string, num: string) => {
      const targetId = resolveSectionTarget(num);
      const label = `${_kw} ${num}`;
      return `${lead}${protect(renderCrossRefButton(label, targetId, previewFor(targetId)))}`;
    }
  );

  // Restore protected placeholders.
  placeholders.forEach((html, key) => {
    working = working.split(key).join(html);
  });
  return working;
}

/**
 * Link cross-references like "section 12", "subsection (3)", "paragraph (a)", "s 5",
 * or "paras 3-5" to in-document scroll targets. Sub-section / paragraph references
 * resolve to the enclosing section anchor when `currentSectionId` is supplied.
 *
 * Sections use the SSO anchor convention where section N maps to id "prN-he-".
 */
export function linkCrossReferences(html: string, context: CrossRefContext = {}): string {
  const segments = splitPreservingTags(html);
  const processed = segments.map((seg) => {
    if (seg.isTag) return seg.text;
    return rewriteCrossRefSegment(seg.text, context);
  });
  return processed.join('');
}

/**
 * Process content lines with proper formatting
 * Note: Logical connectors are already formatted in integrateDefinitions
 */
export function processContentLines(content: string, context: CrossRefContext = {}): string {
  const lines = content.split('<br>');

  const processedLines = lines.map((line) => {
    if (!line.trim()) return '';

    const linked = linkCrossReferences(line, context); // cross-ref linking

    // Apply indentation if needed
    // Check the original line (without HTML) for indentation pattern
    const textOnly = line.replace(/<[^>]+>/g, '');
    if (needsIndentation(textOnly)) {
      return `<div class="indented-line">${linked}</div>`;
    }

    return `<div class="content-line">${linked}</div>`;
  });

  return processedLines.join('');
}

/**
 * Generate HTML for table of contents
 */
export function generateTableOfContentsHTML(
  legislationTitle: string,
  tocItems: Array<{ referenceText: string; referenceUrl: string }>
): string {
  const tocItemsHTML = tocItems
    .map((item) => {
      const text = item.referenceText;
      const targetId = extractReferenceTargetId(item.referenceUrl);
      const match = text.match(/^(\d+)/);
      const formattedText = match
        ? `<span class="toc-section-number">${escapeHtml(match[0])}.</span> ${escapeHtml(
            text.slice(match[0].length).trim()
          )}`
        : escapeHtml(text);

      const targetAttribute = targetId
        ? ` ${SKILL_HUNTER_IDS.TOC_TARGET_ATTR}="${escapeAttribute(targetId)}"`
        : ' disabled aria-disabled="true"';

      return `
        <li class="toc-item">
          <button type="button" class="toc-link"${targetAttribute}>
            ${formattedText}
          </button>
        </li>`;
    })
    .join('');

  return `
    <div class="toc-container">
      <div class="toc-header">
        <h2 class="toc-title">${escapeHtml(legislationTitle)}</h2>
      </div>
      <div class="toc-content">
        <ul class="toc-list">
          ${tocItemsHTML}
        </ul>
      </div>
    </div>`;
}

/**
 * Generate metadata summary cards for legal research context.
 */
export function generateMetadataSummaryHTML(
  pageBasicData: PageBasicData,
  legislationMetadata: LegislationMetadata
): string {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Status', value: pageBasicData.legislationStatus },
    { label: 'Date', value: legislationMetadata.legislationDate },
    { label: 'Revised Title', value: legislationMetadata.revisedLegislationName },
    {
      label: 'PDF',
      value: pageBasicData.legislationPDFDownloadLink ? 'Official PDF available' : '',
    },
  ].filter((item) => item.value.trim().length > 0);

  if (items.length === 0) {
    return '';
  }

  const cards = items
    .map(
      (item) => `
        <div class="meta-card">
          <div class="meta-label">${escapeHtml(item.label)}</div>
          <div class="meta-value">${escapeHtml(item.value)}</div>
        </div>`
    )
    .join('');

  return `
    <section class="metadata-grid" aria-label="Legislation metadata">
      ${cards}
    </section>`;
}

/**
 * Generate HTML for main content
 */
export function generateContentHTML(contentTokens: ContentToken[]): string {
  const sectionPreviews = buildSectionPreviewMap(contentTokens);
  let currentSectionId: string | null = null;

  const contentParts = contentTokens.map((token) => {
    const escapedId = token.ID ? escapeAttribute(token.ID) : null;

    switch (token.type) {
      case 'sectionHeader':
        if (token.ID && sectionNumberFromAnchorId(token.ID)) {
          currentSectionId = token.ID; // refresh section context for nested refs
        }
        return `<h2 class="section-header" ${escapedId ? `id="${escapedId}"` : ''}>${escapeHtml(token.content)}</h2>`;

      case 'sectionBody':
        return `<div class="section-body">${processContentLines(token.content, { currentSectionId, sectionPreviews })}</div>`;

      case 'provisionHeader':
        return `<h3 class="provision-header" ${escapedId ? `id="${escapedId}"` : ''}>${escapeHtml(token.content)}</h3>`;

      case 'provisionNumber':
        return `<div class="provision-number" ${escapedId ? `id="${escapedId}"` : ''}>${escapeHtml(token.content)}</div>`;

      case 'illustrationHeader':
        return `<div class="illustration-header">${escapeHtml(token.content)}</div>`;

      case 'illustrationBody':
        return `<div class="illustration-body">${escapeHtml(token.content)}</div>`;

      default:
        return assertNever(token.type);
    }
  });

  return contentParts.join('');
}

/**
 * Calculate processing time for performance monitoring
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private marks: Map<string, number> = new Map();

  start(): void {
    this.startTime = performance.now();
    this.marks.clear();
  }

  mark(label: string): void {
    const elapsed = performance.now() - this.startTime;
    this.marks.set(label, elapsed);
    logger.debug(`Performance [${label}]: ${elapsed.toFixed(2)}ms`);
  }

  end(): number {
    const totalTime = performance.now() - this.startTime;
    logger.debug(`Total processing time: ${totalTime.toFixed(2)}ms`);
    return totalTime;
  }

  getMarks(): Map<string, number> {
    return new Map(this.marks);
  }
}
