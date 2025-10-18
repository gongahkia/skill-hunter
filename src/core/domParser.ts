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
    logger.warn(`Failed to query selector: ${selector}`, error);
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
    logger.warn(`Failed to query selector all: ${selector}`, error);
    return [] as unknown as NodeListOf<T>;
  }
}

/**
 * Extract basic page metadata
 */
export function getPageMetadata(): PageMetadata {
  const descriptionMeta = safeQuerySelector<HTMLMetaElement>(
    document,
    'meta[name="description"]'
  );
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
    logger.warn('Table of contents panel not found');
    return [];
  }

  const links = safeQuerySelectorAll<HTMLAnchorElement>(tocPanel, SELECTORS.TOC_LINKS);
  const items: TableOfContentsItem[] = [];

  links.forEach((link) => {
    const text = link.innerText.trim();
    const url = link.href.trim();
    if (text && url) {
      items.push({
        referenceText: text,
        referenceUrl: url,
      });
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

    legislationTitle = titleEl?.textContent?.trim() ?? '';
    legislationPdfLink = pdfEl?.parentElement?.getAttribute('href')?.trim() ?? '';
    legislationStatus = statusEl?.textContent?.trim() ?? '';
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
    logger.warn('Legislation front section not found');
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
    legislationName: actHeader?.textContent?.trim() ?? '',
    legislationDescription: longTitle?.textContent?.trim() ?? '',
    legislationDate: cDate?.textContent?.trim() ?? '',
    revisedLegislationName: revisedHeader?.textContent?.trim() ?? '',
    revisedLegislationText: revisedText?.textContent?.trim() ?? '',
  };
}

/**
 * Extract definitions from the legislation using an optimized approach
 */
export function getLegislationDefinitions(): Definition[] {
  const definitions: Definition[] = [];
  const definitionTerms = new Set<string>(); // Prevent duplicates
  // Handle both regular quotes and smart quotes
  const regex = /[""]([^"""]+)[""]/g;

  logger.info('Starting definition extraction...');
  
  const provisionContainers = safeQuerySelectorAll(
    document,
    `${SELECTORS.LEGIS_CONTENT} ${SELECTORS.LEGIS_BODY} ${SELECTORS.PROVISION_CONTAINERS}`
  );

  logger.info(`Found ${provisionContainers.length} provision containers`);
  
  // Also try a broader search to see what's available
  const allProvisionDivs = safeQuerySelectorAll(document, "div[class^='prov']");
  logger.info(`Found ${allProvisionDivs.length} divs with class starting with 'prov'`);
  
  // Check for definition cells with different selectors
  const defCells1 = safeQuerySelectorAll(document, 'td.def');
  const defCells2 = safeQuerySelectorAll(document, 'td[class*="def"]');
  const defCells3 = safeQuerySelectorAll(document, 'td[class*="Def"]');
  
  logger.info(`Found ${defCells1.length} cells with class 'def'`);
  logger.info(`Found ${defCells2.length} cells with class containing 'def'`);
  logger.info(`Found ${defCells3.length} cells with class containing 'Def'`);

  provisionContainers.forEach((container, index) => {
    const definitionCells = safeQuerySelectorAll(container, SELECTORS.DEFINITION_CELL);
    logger.info(`Container ${index}: found ${definitionCells.length} definition cells`);

    definitionCells.forEach((cell, cellIndex) => {
      const sentence = cell.textContent?.trim() ?? '';
      logger.info(`Cell ${cellIndex}: "${sentence.substring(0, 100)}${sentence.length > 100 ? '...' : ''}"`);
      
      if (!sentence) return;

      // Reset regex lastIndex for each iteration
      regex.lastIndex = 0;
      const match = regex.exec(sentence);

      if (match && match[1]) {
        const term = match[1].trim();
        logger.info(`Found definition term: "${term}"`);
        
        // Only add if we haven't seen this term before
        if (!definitionTerms.has(term)) {
          definitionTerms.add(term);
          definitions.push({ [term]: sentence });
        }
      }
    });
  });

  logger.info(`Extracted ${definitions.length} definitions`);
  return definitions;
}

/**
 * Extract main legislation content with optimized parsing
 */
export function getLegislationContent(): ContentToken[] {
  const content: ContentToken[] = [];

  logger.info('Starting content extraction...');
  
  const provisionContainers = safeQuerySelectorAll(
    document,
    `${SELECTORS.LEGIS_CONTENT} ${SELECTORS.LEGIS_BODY} ${SELECTORS.PROVISION_CONTAINERS}`
  );

  logger.info(`Found ${provisionContainers.length} provision containers for content extraction`);
  
  // Also check what we can find with broader selectors
  const legisContent = safeQuerySelector(document, SELECTORS.LEGIS_CONTENT);
  const legisBody = safeQuerySelector(document, SELECTORS.LEGIS_BODY);
  logger.info(`Legis content element: ${legisContent ? 'found' : 'not found'}`);
  logger.info(`Legis body element: ${legisBody ? 'found' : 'not found'}`);

  if (provisionContainers.length === 0) {
    logger.warn('No provision containers found, trying alternative selectors...');
    
    // Try alternative selectors
    const altContainers = safeQuerySelectorAll(document, "div[class^='prov']");
    logger.info(`Found ${altContainers.length} alternative provision containers`);
    
    if (altContainers.length === 0) {
      throw new DOMParsingError('No provision containers found in document');
    }
    
    // Use alternative containers
    altContainers.forEach((container) => {
      const rows = safeQuerySelectorAll(container, 'table tbody tr');
      logger.info(`Alternative container: found ${rows.length} rows`);
      
      rows.forEach((row) => {
        // Section Header
        const sectionHeader = safeQuerySelector(row, SELECTORS.SECTION_HEADER);
        if (sectionHeader) {
          const headerText = sectionHeader.textContent?.trim() ?? '';
          const headerId = sectionHeader.id?.trim() ?? null;

          if (headerText) {
            content.push({
              type: 'sectionHeader',
              ID: headerId,
              content: headerText,
            });
          }
        }

        // Section Body
        const sectionBody = safeQuerySelector(row, SELECTORS.SECTION_BODY);
        if (sectionBody) {
          const bodyText = sectionBody.textContent?.trim() ?? '';
          if (bodyText) {
            content.push({
              type: 'sectionBody',
              ID: null,
              content: bodyText,
            });
          }
        }
      });
    });
    
    logger.info(`Extracted ${content.length} content tokens using alternative method`);
    return content;
  }

  provisionContainers.forEach((container) => {
    const rows = safeQuerySelectorAll(container, 'table tbody tr');

    rows.forEach((row) => {
      // Section Header
      const sectionHeader = safeQuerySelector(row, SELECTORS.SECTION_HEADER);
      if (sectionHeader) {
        const headerText = sectionHeader.textContent?.trim() ?? '';
        const headerId = sectionHeader.id?.trim() ?? null;

        if (headerText) {
          content.push({
            type: 'sectionHeader',
            ID: headerId,
            content: headerText,
          });
        }
      }

      // Illustration Header or Content
      const illustrationCell = safeQuerySelector(row, SELECTORS.ILLUSTRATION_CELL);
      if (illustrationCell) {
        const innerHTML = illustrationCell.innerHTML;
        const text = illustrationCell.textContent?.trim() ?? '';

        if (innerHTML.includes('<em>Illustration</em>') || innerHTML.includes('<em>Illustrations</em>')) {
          content.push({
            type: 'illustrationHeader',
            ID: null,
            content: text,
          });
        } else if (text) {
          content.push({
            type: 'illustrationBody',
            ID: null,
            content: text,
          });
        }
      }

      // Section Body
      const sectionBody = safeQuerySelector(row, SELECTORS.SECTION_BODY);
      if (sectionBody) {
        const bodyText = sectionBody.textContent?.trim() ?? '';
        if (bodyText) {
          content.push({
            type: 'sectionBody',
            ID: null,
            content: bodyText,
          });
        }
      }

      // Provision Header
      const provisionHeader = safeQuerySelector(row, SELECTORS.PROVISION_HEADER);
      if (provisionHeader) {
        const provisionHeaderId = provisionHeader.id || null;
        const provisionHeaderText = provisionHeader.textContent?.trim() ?? '';

        if (provisionHeaderText) {
          content.push({
            type: 'provisionHeader',
            ID: provisionHeaderId,
            content: provisionHeaderText,
          });
        }
      }

      // Provision Number
      const provisionNumber = safeQuerySelector(row, SELECTORS.PROVISION_NUMBER);
      if (provisionNumber) {
        const provisionNumberId = provisionNumber.id || null;
        const provisionNumberDiv = safeQuerySelector(
          provisionNumber,
          SELECTORS.PROVISION_NUMBER_DIV
        );
        const provisionNumberText = provisionNumberDiv?.textContent?.trim() ?? '';

        if (provisionNumberText) {
          content.push({
            type: 'provisionNumber',
            ID: provisionNumberId,
            content: provisionNumberText,
          });
        }
      }
    });
  });

  logger.info(`Extracted ${content.length} content tokens`);
  return content;
}

