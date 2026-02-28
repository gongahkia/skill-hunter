import {
  extractVisibleContractText,
  type DomExtractionResult
} from "./dom-extractor";

const GMAIL_HOSTNAME = "mail.google.com";
const GMAIL_MESSAGE_BODY_SELECTORS = [
  "div.adn.ads div.a3s.aiL",
  "div[role='listitem'] div.a3s.aiL",
  "div.a3s.aiL"
];
const GMAIL_SUBJECT_SELECTORS = [
  "h2.hP",
  "h2[data-thread-perm-id]",
  "h2[role='heading']"
];

function isGmailPage(pageUrl: string) {
  try {
    const url = new URL(pageUrl);
    return url.hostname.toLowerCase() === GMAIL_HOSTNAME;
  } catch (_error) {
    return false;
  }
}

function hasVisibleContent(element: Element) {
  const htmlElement = element as HTMLElement;
  if (htmlElement.offsetParent === null && htmlElement.getClientRects().length === 0) {
    return false;
  }

  const text = htmlElement.innerText?.trim() ?? "";
  return text.length > 0;
}

function getMessageBodyRoots(doc: Document) {
  const candidates = new Set<Element>();

  for (const selector of GMAIL_MESSAGE_BODY_SELECTORS) {
    for (const element of Array.from(doc.querySelectorAll(selector))) {
      if (!hasVisibleContent(element)) {
        continue;
      }
      candidates.add(element);
    }
  }

  return Array.from(candidates);
}

function getGmailSubject(doc: Document) {
  for (const selector of GMAIL_SUBJECT_SELECTORS) {
    const element = doc.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return null;
}

export function extractGmailMessageBody(
  doc: Document,
  pageUrl: string,
  legalSignalLabels: string[]
): DomExtractionResult | null {
  if (!isGmailPage(pageUrl) || legalSignalLabels.length === 0) {
    return null;
  }

  const messageBodyRoots = getMessageBodyRoots(doc);
  if (messageBodyRoots.length === 0) {
    return null;
  }

  const subject = getGmailSubject(doc);
  return extractVisibleContractText(doc, pageUrl, {
    includeWithin: messageBodyRoots,
    titleOverride: subject ?? undefined
  });
}
