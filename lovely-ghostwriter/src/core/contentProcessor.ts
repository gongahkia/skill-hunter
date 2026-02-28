/**
 * Content processing utilities for transforming and enhancing legislation content
 */

import type { ContentToken, Definition } from '@/types';
import { LOGICAL_CONNECTORS } from '@/utils/constants';
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  logger.debug(`Processing ${sectionBodyTokens.length} section body tokens with ${sortedDefinitions.length} definitions`);

  sectionBodyTokens.forEach((token) => {
    const lines = token.content.split('\n');

    const processedLines = lines.map((line) => {
      // First, format logical connectors (this adds HTML tags)
      let modifiedLine = formatLogicalConnectors(line);

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
          const placeholder = `___STATUTE_TERM_${Math.random().toString(36).substr(2, 9)}___`;
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
      const match = text.match(/^(\d+)/);
      const formattedText = match
        ? `<span class="toc-section-number">${match[0]}.</span> ${text.slice(match[0].length).trim()}`
        : text;

      return `
        <li class="toc-item">
          <a href="${item.referenceUrl}" target="_blank" class="toc-link">
            ${formattedText}
          </a>
        </li>`;
    })
    .join('');

  return `
    <div class="toc-container">
      <div class="toc-header">
        <h2 class="toc-title">${legislationTitle}</h2>
      </div>
      <div class="toc-content">
        <ul class="toc-list">
          ${tocItemsHTML}
        </ul>
      </div>
    </div>`;
}

/**
 * Generate HTML for main content
 */
export function generateContentHTML(contentTokens: ContentToken[]): string {
  const contentParts = contentTokens.map((token) => {
    switch (token.type) {
      case 'sectionHeader':
        return `<h2 class="section-header" ${token.ID ? `id="${token.ID}"` : ''}>${token.content}</h2>`;

      case 'sectionBody':
        return `<div class="section-body">${processContentLines(token.content)}</div>`;

      case 'provisionHeader':
        return `<h3 class="provision-header" ${token.ID ? `id="${token.ID}"` : ''}>${token.content}</h3>`;

      case 'provisionNumber':
        return `<div class="provision-number" ${token.ID ? `id="${token.ID}"` : ''}>${token.content}</div>`;

      case 'illustrationHeader':
        return `<div class="illustration-header">${token.content}</div>`;

      case 'illustrationBody':
        return `<div class="illustration-body">${token.content}</div>`;

      default:
        logger.warn(`Unknown content token type: ${token.type}`);
        return '';
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

