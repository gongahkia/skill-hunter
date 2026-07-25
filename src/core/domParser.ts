/**
 * Optimized DOM parsing utilities for extracting legislation content
 */

import type {
  PageMetadata,
  PageBasicData,
  TableOfContentsItem,
  LegislationMetadata,
  Definition,
  ContentToken,
} from '@/types';
import { SELECTORS } from '@/utils/constants';
import { DOMParsingError } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';

const parserLogger = logger.withContext('domParser');

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Safely query a single element
 */
function safeQuerySelector<T extends Element = Element>(
  parent: Document | Element,
  selector: string
): T | null {
  try {
    return parent.querySelector<T>(selector);
  } catch (error) {
    parserLogger.warn('Failed to query selector', { selector, error });
    return null;
  }
}

/**
 * Safely query multiple elements
 */
function safeQuerySelectorAll<T extends Element = Element>(
  parent: Document | Element,
  selector: string
): NodeListOf<T> | [] {
  try {
    return parent.querySelectorAll<T>(selector);
  } catch (error) {
    parserLogger.warn('Failed to query selector list', { selector, error });
    return [] as unknown as NodeListOf<T>;
  }
}

function deriveTitleFallback(pageTitle: string): string {
  if (!pageTitle.trim()) {
    return 'Untitled Legislation';
  }

  return pageTitle.split('|')[0]?.trim() || pageTitle.trim();
}

/**
 * Extract basic page metadata
 */
export function getPageMetadata(): PageMetadata {
  const descriptionMeta = safeQuerySelector<HTMLMetaElement>(document, 'meta[name="description"]');
  const logoRef = safeQuerySelector<HTMLLinkElement>(
    document,
    'link[rel="icon"], link[rel="shortcut icon"]'
  );

  return {
    url: window.location.href,
    title: document.title,
    logoLink: logoRef?.href ?? '',
    characterSet: document.characterSet,
    description: descriptionMeta?.content ?? '',
  };
}

/**
 * Extract table of contents items
 */
function extractTableOfContents(): TableOfContentsItem[] {
  const tocPanel = safeQuerySelector(document, SELECTORS.TOC_PANEL);
  if (!tocPanel) {
    parserLogger.warn('Table of contents panel not found');
    return [];
  }

  const links = safeQuerySelectorAll<HTMLAnchorElement>(tocPanel, SELECTORS.TOC_LINKS);
  const items: TableOfContentsItem[] = [];

  links.forEach((link) => {
    const text = normalizeText(link.innerText);
    const url = normalizeText(link.href);
    if (text && url) {
      items.push({ referenceText: text, referenceUrl: url });
    }
  });

  return items;
}

/**
 * Extract page basic data including legislation title and status
 */
export function getPageBasicData(): { pageMetadata: PageMetadata; pageBasicData: PageBasicData } {
  const pageMetadata = getPageMetadata();
  const header = safeQuerySelector(document, SELECTORS.TOP_PANEL);

  let legislationTitle = '';
  let legislationPdfLink = '';
  let legislationStatus = '';

  if (header) {
    const titleEl = safeQuerySelector(header, SELECTORS.LEGIS_TITLE);
    const pdfEl = safeQuerySelector(header, SELECTORS.PDF_LINK);
    const statusEl = safeQuerySelector(header, SELECTORS.STATUS_VALUE);

    legislationTitle =
      normalizeText(titleEl?.textContent) || deriveTitleFallback(pageMetadata.title);
    legislationPdfLink = normalizeText(pdfEl?.parentElement?.getAttribute('href'));
    legislationStatus = normalizeText(statusEl?.textContent);
  } else {
    parserLogger.warn('Top panel not found, using fallback metadata');
    legislationTitle = deriveTitleFallback(pageMetadata.title);
  }

  const tableOfContents = extractTableOfContents();

  return {
    pageMetadata,
    pageBasicData: {
      legislationTitle,
      legislationPDFDownloadLink: legislationPdfLink,
      legislationStatus,
      tableOfContents,
    },
  };
}

/**
 * Extract legislation metadata from the front section
 */
export function getLegislationMetadata(): LegislationMetadata {
  const legisFront = safeQuerySelector(document, SELECTORS.LEGIS_FRONT);

  if (!legisFront) {
    parserLogger.warn('Legislation front section not found');
    return {
      legislationName: '',
      legislationDescription: '',
      legislationDate: '',
      revisedLegislationName: '',
      revisedLegislationText: '',
    };
  }

  const actHeader = safeQuerySelector(legisFront, SELECTORS.ACT_HEADER);
  const longTitle = safeQuerySelector(legisFront, SELECTORS.LONG_TITLE);
  const cDate = safeQuerySelector(legisFront, SELECTORS.C_DATE);
  const revisedHeader = safeQuerySelector(legisFront, SELECTORS.REVISED_HEADER);
  const revisedText = safeQuerySelector(legisFront, SELECTORS.REVISED_TEXT);

  return {
    legislationName: normalizeText(actHeader?.textContent),
    legislationDescription: normalizeText(longTitle?.textContent),
    legislationDate: normalizeText(cDate?.textContent),
    revisedLegislationName: normalizeText(revisedHeader?.textContent),
    revisedLegislationText: normalizeText(revisedText?.textContent),
  };
}

/**
 * Extract definitions from the legislation using an optimized approach
 */
export function getLegislationDefinitions(): Definition[] {
  const definitions: Definition[] = [];
  const definitionTerms = new Set<string>();
  const regex = /\u201C([^\u201D]+)\u201D/g;

  const provisionContainers = safeQuerySelectorAll(
    document,
    `${SELECTORS.LEGIS_CONTENT} ${SELECTORS.LEGIS_BODY} ${SELECTORS.PROVISION_CONTAINERS}`
  );

  provisionContainers.forEach((container) => {
    const definitionCells = safeQuerySelectorAll(container, SELECTORS.DEFINITION_CELL);

    definitionCells.forEach((cell) => {
      const sentence = normalizeText(cell.textContent);
      if (!sentence) {
        return;
      }

      regex.lastIndex = 0;
      const match = regex.exec(sentence);
      const term = normalizeText(match?.[1]);

      if (!term || definitionTerms.has(term)) {
        return;
      }

      definitionTerms.add(term);
      definitions.push({ [term]: sentence });
    });
  });

  parserLogger.info('Definition extraction completed', {
    count: definitions.length,
    containerCount: provisionContainers.length,
  });

  return definitions;
}

function pushToken(content: ContentToken[], token: ContentToken): void {
  if (!normalizeText(token.content)) {
    return;
  }

  content.push(token);
}

function parseRowsIntoTokens(rows: NodeListOf<Element> | [], content: ContentToken[]): void {
  rows.forEach((row) => {
    const sectionHeader = safeQuerySelector(row, SELECTORS.SECTION_HEADER);
    pushToken(content, {
      type: 'sectionHeader',
      ID: normalizeText(sectionHeader?.id) || null,
      content: normalizeText(sectionHeader?.textContent),
    });

    const illustrationCell = safeQuerySelector(row, SELECTORS.ILLUSTRATION_CELL);
    if (illustrationCell) {
      const innerHTML = illustrationCell.innerHTML;
      const text = normalizeText(illustrationCell.textContent);

      if (
        innerHTML.includes('<em>Illustration</em>') ||
        innerHTML.includes('<em>Illustrations</em>')
      ) {
        pushToken(content, { type: 'illustrationHeader', ID: null, content: text });
      } else {
        pushToken(content, { type: 'illustrationBody', ID: null, content: text });
      }
    }

    const sectionBody = safeQuerySelector(row, SELECTORS.SECTION_BODY);
    pushToken(content, {
      type: 'sectionBody',
      ID: null,
      content: normalizeText(sectionBody?.textContent),
    });

    const provisionHeader = safeQuerySelector(row, SELECTORS.PROVISION_HEADER);
    pushToken(content, {
      type: 'provisionHeader',
      ID: normalizeText(provisionHeader?.id) || null,
      content: normalizeText(provisionHeader?.textContent),
    });

    const provisionNumber = safeQuerySelector(row, SELECTORS.PROVISION_NUMBER);
    const provisionNumberDiv = safeQuerySelector(
      provisionNumber ?? row,
      SELECTORS.PROVISION_NUMBER_DIV
    );
    pushToken(content, {
      type: 'provisionNumber',
      ID: normalizeText(provisionNumber?.id) || null,
      content: normalizeText(provisionNumberDiv?.textContent),
    });
  });
}

/**
 * Extract main legislation content with optimized parsing
 */
export function getLegislationContent(): ContentToken[] {
  const content: ContentToken[] = [];

  const primaryContainers = safeQuerySelectorAll(
    document,
    `${SELECTORS.LEGIS_CONTENT} ${SELECTORS.LEGIS_BODY} ${SELECTORS.PROVISION_CONTAINERS}`
  );

  const fallbackContainers =
    primaryContainers.length > 0
      ? primaryContainers
      : safeQuerySelectorAll(document, "div[class^='prov']");

  fallbackContainers.forEach((container) => {
    const rows = safeQuerySelectorAll(container, 'table tbody tr');
    parseRowsIntoTokens(rows, content);
  });

  if (content.length === 0) {
    throw new DOMParsingError('No readable legislation content could be extracted from this page');
  }

  parserLogger.info('Content extraction completed', {
    tokenCount: content.length,
    containerCount: fallbackContainers.length,
  });

  return content;
}
