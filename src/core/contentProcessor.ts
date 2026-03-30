/**
 * Content processing utilities for transforming and enhancing legislation content
 */

import type { ContentToken, Definition, LegislationMetadata, PageBasicData } from '@/types';
import { LOGICAL_CONNECTORS, SKILL_HUNTER_IDS } from '@/utils/constants';
import { logger } from '@/utils/logger';

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

        // Process each definition, but only in plain text
        sortedDefinitions.forEach((definitionPair) => {
          const term = Object.keys(definitionPair)[0];
          if (!term) return;

          const definition = definitionPair[term];
          if (!definition) return;

          // Escape special regex characters in the term
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Create a regex that matches whole words only, case-insensitive
          const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'gi');

          // Replace term with definition tooltip
          // Use a placeholder to prevent recursive replacements
          const placeholder = `___STATUTE_TERM_${Math.random().toString(36).slice(2, 11)}___`;
          const replacementMap = new Map<string, string>();

          textSegment = textSegment.replace(regex, (match) => {
            const key = `${placeholder}${replacementMap.size}`;
            // Escape the definition text to prevent HTML injection
            const escapedDefinition = escapeHtml(definition);
            replacementMap.set(
              key,
              `<span class="statute-term">${match}<div class="statute-tooltip">${escapedDefinition}</div></span>`
            );
            return key;
          });

          // Replace placeholders with actual HTML
          replacementMap.forEach((value, key) => {
            textSegment = textSegment.replace(key, value);
          });
        });

        return textSegment;
      });

      return processedSegments.join('');
    });

    // Update the token content
    token.content = processedLines.join('<br>');
  });
}

/**
 * Process content lines with proper formatting
 * Note: Logical connectors are already formatted in integrateDefinitions
 */
export function processContentLines(content: string): string {
  const lines = content.split('<br>');

  const processedLines = lines.map((line) => {
    if (!line.trim()) return '';

    // Apply indentation if needed
    // Check the original line (without HTML) for indentation pattern
    const textOnly = line.replace(/<[^>]+>/g, '');
    if (needsIndentation(textOnly)) {
      return `<div class="indented-line">${line}</div>`;
    }

    return `<div class="content-line">${line}</div>`;
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
  const contentParts = contentTokens.map((token) => {
    const escapedId = token.ID ? escapeAttribute(token.ID) : null;

    switch (token.type) {
      case 'sectionHeader':
        return `<h2 class="section-header" ${escapedId ? `id="${escapedId}"` : ''}>${escapeHtml(token.content)}</h2>`;

      case 'sectionBody':
        return `<div class="section-body">${processContentLines(token.content)}</div>`;

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
