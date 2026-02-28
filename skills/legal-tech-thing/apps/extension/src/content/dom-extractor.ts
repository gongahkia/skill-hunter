export const DOM_EXTRACTION_MESSAGE_TYPE = "extension.domExtraction.v1";

const MAX_EXTRACTED_CHARS = 90_000;
const MAX_SPANS = 1_500;

const BLOCK_TAG_NAMES = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "DL",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL"
]);

const NON_CONTENT_TAGS = new Set([
  "HEAD",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "META",
  "LINK",
  "TITLE"
]);

export interface ExtractedTextSpan {
  start: number;
  end: number;
  nodePath: number[];
  sourceStart: number;
  sourceEnd: number;
}

export interface DomExtractionResult {
  url: string;
  title: string;
  extractedText: string;
  spans: ExtractedTextSpan[];
  extractedCharacters: number;
  truncated: boolean;
  extractedAt: string;
}

interface TextBounds {
  start: number;
  end: number;
}

interface TextChunk {
  normalizedText: string;
  sourceStart: number;
  sourceEnd: number;
}

function getNodePath(node: Node, root: Node) {
  const path: number[] = [];
  let cursor: Node | null = node;

  while (cursor && cursor !== root) {
    const parentNode: Node | null = cursor.parentNode;
    if (!parentNode) {
      return [];
    }

    const indexInParent = Array.prototype.indexOf.call(parentNode.childNodes, cursor) as number;
    if (indexInParent < 0) {
      return [];
    }

    path.unshift(indexInParent);
    cursor = parentNode;
  }

  return cursor === root ? path : [];
}

function trimBounds(text: string): TextBounds | null {
  let start = 0;
  let end = text.length;

  while (start < end && /\s/.test(text[start] ?? "")) {
    start += 1;
  }

  while (end > start && /\s/.test(text[end - 1] ?? "")) {
    end -= 1;
  }

  if (start >= end) {
    return null;
  }

  return { start, end };
}

function toNormalizedChunk(rawText: string): TextChunk | null {
  const bounds = trimBounds(rawText);
  if (!bounds) {
    return null;
  }

  const trimmed = rawText.slice(bounds.start, bounds.end);
  const normalizedText = trimmed.replace(/\s+/g, " ");

  if (!normalizedText) {
    return null;
  }

  return {
    normalizedText,
    sourceStart: bounds.start,
    sourceEnd: bounds.end
  };
}

function findBlockKey(element: Element) {
  let cursor: Element | null = element;

  while (cursor) {
    if (BLOCK_TAG_NAMES.has(cursor.tagName)) {
      return cursor.tagName;
    }
    cursor = cursor.parentElement;
  }

  return "INLINE";
}

function isElementVisible(element: Element, visibilityCache: WeakMap<Element, boolean>) {
  const cached = visibilityCache.get(element);
  if (cached !== undefined) {
    return cached;
  }

  if (NON_CONTENT_TAGS.has(element.tagName)) {
    visibilityCache.set(element, false);
    return false;
  }

  let cursor: Element | null = element;
  while (cursor) {
    if (NON_CONTENT_TAGS.has(cursor.tagName)) {
      visibilityCache.set(element, false);
      return false;
    }

    const style = window.getComputedStyle(cursor);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden"
    ) {
      visibilityCache.set(element, false);
      return false;
    }

    if (style.opacity === "0") {
      visibilityCache.set(element, false);
      return false;
    }

    cursor = cursor.parentElement;
  }

  if (element.getClientRects().length === 0) {
    visibilityCache.set(element, false);
    return false;
  }

  visibilityCache.set(element, true);
  return true;
}

export function extractVisibleContractText(doc: Document, pageUrl: string): DomExtractionResult {
  const root = doc.body ?? doc.documentElement;
  const spans: ExtractedTextSpan[] = [];
  const visibilityCache = new WeakMap<Element, boolean>();

  if (!root) {
    return {
      url: pageUrl,
      title: doc.title ?? "",
      extractedText: "",
      spans,
      extractedCharacters: 0,
      truncated: false,
      extractedAt: new Date().toISOString()
    };
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let cursor = 0;
  let truncated = false;
  let previousBlockKey: string | null = null;

  while (cursor < MAX_EXTRACTED_CHARS && spans.length < MAX_SPANS) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }

    const textNode = node as Text;
    const parentElement = textNode.parentElement;
    if (!parentElement) {
      continue;
    }

    if (!isElementVisible(parentElement, visibilityCache)) {
      continue;
    }

    const chunk = toNormalizedChunk(textNode.nodeValue ?? "");
    if (!chunk) {
      continue;
    }

    const nodePath = getNodePath(textNode, root);
    if (nodePath.length === 0) {
      continue;
    }

    const blockKey = findBlockKey(parentElement);
    if (cursor > 0) {
      const separator = previousBlockKey === blockKey ? " " : "\n";
      if (cursor + separator.length > MAX_EXTRACTED_CHARS) {
        truncated = true;
        break;
      }
      parts.push(separator);
      cursor += separator.length;
    }

    const availableChars = MAX_EXTRACTED_CHARS - cursor;
    if (availableChars <= 0) {
      truncated = true;
      break;
    }

    const appendedText = chunk.normalizedText.slice(0, availableChars);
    const spanStart = cursor;
    const spanEnd = spanStart + appendedText.length;

    let sourceEnd = chunk.sourceEnd;
    if (appendedText.length < chunk.normalizedText.length) {
      const fraction = appendedText.length / chunk.normalizedText.length;
      sourceEnd = chunk.sourceStart + Math.floor((chunk.sourceEnd - chunk.sourceStart) * fraction);
      truncated = true;
    }

    parts.push(appendedText);
    spans.push({
      start: spanStart,
      end: spanEnd,
      nodePath,
      sourceStart: chunk.sourceStart,
      sourceEnd
    });

    cursor = spanEnd;
    previousBlockKey = blockKey;
  }

  if (spans.length >= MAX_SPANS) {
    truncated = true;
  }

  return {
    url: pageUrl,
    title: doc.title ?? "",
    extractedText: parts.join(""),
    spans,
    extractedCharacters: cursor,
    truncated,
    extractedAt: new Date().toISOString()
  };
}
