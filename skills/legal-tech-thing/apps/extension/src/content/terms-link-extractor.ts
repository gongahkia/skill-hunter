export const TERMS_LINK_EXTRACTION_MESSAGE_TYPE = "extension.termsLinks.v1";

const LEGAL_LINK_PATTERN =
  /\b(?:terms|conditions|privacy|policy|legal|agreement|eula|license|cookie|gdpr|data processing)\b/i;
const CONSENT_CHECKBOX_PATTERN =
  /\b(?:i agree|i accept|consent|terms|privacy|conditions|policy|legal|authorization)\b/i;
const ACCEPTANCE_BUTTON_PATTERN =
  /\b(?:accept|agree|continue|submit|confirm|register|sign up|start trial|place order|checkout)\b/i;

const MAX_LINK_RESULTS = 20;
const MAX_CONTROLS = 30;
const MAX_FALLBACK_LINK_SCAN = 200;

export type ConsentControlType = "checkbox" | "accept-button";

export interface TermsLinkMatch {
  url: string;
  label: string;
  relevanceScore: number;
  controlType: ConsentControlType;
  controlLabel: string;
  anchorPath: number[];
  controlPath: number[];
}

export interface TermsLinkExtractionResult {
  url: string;
  title: string;
  links: TermsLinkMatch[];
  extractedAt: string;
}

interface ConsentControlCandidate {
  element: Element;
  label: string;
  type: ConsentControlType;
}

function toNodePath(node: Node, root: Node) {
  const path: number[] = [];
  let cursor: Node | null = node;

  while (cursor && cursor !== root) {
    const parentNode: Node | null = cursor.parentNode;
    if (!parentNode) {
      return [];
    }
    const index = Array.prototype.indexOf.call(parentNode.childNodes, cursor) as number;
    if (index < 0) {
      return [];
    }
    path.unshift(index);
    cursor = parentNode;
  }

  return cursor === root ? path : [];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getElementLabel(element: Element) {
  const fromAria = element.getAttribute("aria-label") ?? "";
  const fromDataLabel = element.getAttribute("data-label") ?? "";

  if (element instanceof HTMLInputElement) {
    return normalizeWhitespace([fromAria, fromDataLabel, element.value].filter(Boolean).join(" "));
  }

  return normalizeWhitespace(
    [fromAria, fromDataLabel, element.textContent ?? "", (element as HTMLElement).innerText ?? ""]
      .filter(Boolean)
      .join(" ")
  );
}

function getCheckboxConsentText(checkbox: HTMLInputElement) {
  const labelText = Array.from(checkbox.labels ?? [])
    .map((label) => normalizeWhitespace(label.innerText || label.textContent || ""))
    .filter(Boolean)
    .join(" ");
  const parentText = normalizeWhitespace(
    checkbox.closest("label, form, div, section, article")?.textContent ?? ""
  );

  return normalizeWhitespace([checkbox.getAttribute("aria-label") ?? "", labelText, parentText].join(" "));
}

function isVisible(element: Element) {
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    style.opacity === "0"
  ) {
    return false;
  }

  return element.getClientRects().length > 0;
}

function isLegalLink(anchor: HTMLAnchorElement) {
  const label = normalizeWhitespace(anchor.innerText || anchor.textContent || "");
  const href = anchor.getAttribute("href") ?? "";
  return LEGAL_LINK_PATTERN.test(label) || LEGAL_LINK_PATTERN.test(href);
}

function scoreLink(
  anchor: HTMLAnchorElement,
  controlText: string,
  sameContainer: boolean,
  relativeDistance: number
) {
  const label = normalizeWhitespace(anchor.innerText || anchor.textContent || "");
  const href = anchor.getAttribute("href") ?? "";

  let score = 1;
  if (LEGAL_LINK_PATTERN.test(label)) {
    score += 2;
  }
  if (LEGAL_LINK_PATTERN.test(href)) {
    score += 2;
  }
  if (LEGAL_LINK_PATTERN.test(controlText)) {
    score += 1;
  }
  if (sameContainer) {
    score += 1;
  }
  if (relativeDistance <= 200) {
    score += 1;
  }

  return score;
}

function findNearbyAnchors(control: Element, doc: Document) {
  const nearbyAnchors = new Set<HTMLAnchorElement>();

  let cursor: Element | null = control;
  for (let depth = 0; depth < 5 && cursor; depth += 1) {
    const localAnchors = Array.from(cursor.querySelectorAll<HTMLAnchorElement>("a[href]"));
    for (const anchor of localAnchors) {
      nearbyAnchors.add(anchor);
    }
    cursor = cursor.parentElement;
  }

  if (nearbyAnchors.size > 0) {
    return Array.from(nearbyAnchors);
  }

  const controlRect = control.getBoundingClientRect();
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]")).slice(
    0,
    MAX_FALLBACK_LINK_SCAN
  );
  const fallbackAnchors: HTMLAnchorElement[] = [];

  for (const anchor of anchors) {
    if (!isVisible(anchor)) {
      continue;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const verticalDistance = Math.abs(anchorRect.top - controlRect.top);
    const horizontalDistance = Math.abs(anchorRect.left - controlRect.left);
    if (verticalDistance <= 500 && horizontalDistance <= 600) {
      fallbackAnchors.push(anchor);
    }
  }

  return fallbackAnchors;
}

function resolveAbsoluteUrl(href: string, base: string) {
  try {
    return new URL(href, base).toString();
  } catch (_error) {
    return null;
  }
}

function collectConsentControls(doc: Document) {
  const controls: ConsentControlCandidate[] = [];

  const checkboxes = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  for (const checkbox of checkboxes) {
    if (!isVisible(checkbox)) {
      continue;
    }
    const consentText = getCheckboxConsentText(checkbox);
    if (!consentText || !CONSENT_CHECKBOX_PATTERN.test(consentText)) {
      continue;
    }
    controls.push({
      element: checkbox,
      label: consentText,
      type: "checkbox"
    });
    if (controls.length >= MAX_CONTROLS) {
      return controls;
    }
  }

  const buttons = Array.from(
    doc.querySelectorAll(
      'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]'
    )
  );

  for (const button of buttons) {
    if (!isVisible(button)) {
      continue;
    }

    const label = getElementLabel(button);
    if (!label || !ACCEPTANCE_BUTTON_PATTERN.test(label)) {
      continue;
    }

    controls.push({
      element: button,
      label,
      type: "accept-button"
    });
    if (controls.length >= MAX_CONTROLS) {
      break;
    }
  }

  return controls;
}

export function extractTermsLinksNearConsentControls(
  doc: Document,
  pageUrl: string
): TermsLinkExtractionResult {
  const root = doc.body ?? doc.documentElement;
  const controls = collectConsentControls(doc);
  const dedupedResults = new Map<string, TermsLinkMatch>();

  for (const control of controls) {
    const controlPath = toNodePath(control.element, root);
    if (controlPath.length === 0) {
      continue;
    }

    const anchors = findNearbyAnchors(control.element, doc);
    for (const anchor of anchors) {
      if (!isVisible(anchor)) {
        continue;
      }
      if (!isLegalLink(anchor)) {
        continue;
      }

      const href = anchor.getAttribute("href");
      if (!href) {
        continue;
      }

      const absoluteUrl = resolveAbsoluteUrl(href, pageUrl);
      if (!absoluteUrl) {
        continue;
      }

      const anchorPath = toNodePath(anchor, root);
      if (anchorPath.length === 0) {
        continue;
      }

      const sameContainer =
        anchor.closest("form, section, article, dialog, div") ===
        control.element.closest("form, section, article, dialog, div");
      const anchorRect = anchor.getBoundingClientRect();
      const controlRect = control.element.getBoundingClientRect();
      const relativeDistance =
        Math.abs(anchorRect.top - controlRect.top) + Math.abs(anchorRect.left - controlRect.left);
      const score = scoreLink(anchor, control.label, sameContainer, relativeDistance);
      const label = normalizeWhitespace(anchor.innerText || anchor.textContent || absoluteUrl);

      const existing = dedupedResults.get(absoluteUrl);
      if (!existing || existing.relevanceScore < score) {
        dedupedResults.set(absoluteUrl, {
          url: absoluteUrl,
          label,
          relevanceScore: score,
          controlType: control.type,
          controlLabel: control.label,
          anchorPath,
          controlPath
        });
      }
    }
  }

  const links = Array.from(dedupedResults.values())
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_LINK_RESULTS);

  return {
    url: pageUrl,
    title: doc.title ?? "",
    links,
    extractedAt: new Date().toISOString()
  };
}
