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
    const text = normalizeText(link.textContent);
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

  const root = safeQuerySelector(document, SELECTORS.LEGIS_CONTENT);
  const definitionCells = root ? safeQuerySelectorAll(root, SELECTORS.DEFINITION_CELL) : [];
  const ambiguous = new Set<string>();
  definitionCells.forEach((cell) => {
    const sentence = normalizeText(cell.textContent);
    regex.lastIndex = 0;
    const term = normalizeText(regex.exec(sentence)?.[1]);
    if (!term || ambiguous.has(term)) return;
    const prior = definitions.find((pair) => Object.prototype.hasOwnProperty.call(pair, term));
    if (prior && prior[term] !== sentence) {
      definitions.splice(definitions.indexOf(prior), 1);
      ambiguous.add(term);
      return;
    }
    if (!definitionTerms.has(term)) {
      definitionTerms.add(term);
      definitions.push({ [term]: sentence });
    }
  });

  parserLogger.info('Definition extraction completed', {
    count: definitions.length,
    cellCount: definitionCells.length,
  });

  return definitions;
}

/** Keep the full legislative tree; never guess from unrelated page furniture. */
export function getLegislationContent(): ContentToken[] {
  const root = safeQuerySelector(document, SELECTORS.LEGIS_CONTENT);
  if (!root || !normalizeText(root.textContent)) {
    throw new DOMParsingError('No readable legislation content could be extracted from this page');
  }
  return [{ type: 'sourceDocument', ID: null, content: root.innerHTML }];
}
