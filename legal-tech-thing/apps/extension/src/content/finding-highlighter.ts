import type { DomExtractionResult, ExtractedTextSpan } from "./dom-extractor";

export const APPLY_FINDING_HIGHLIGHT_MESSAGE_TYPE = "extension.highlightFinding.v1";
export const CLEAR_FINDING_HIGHLIGHT_MESSAGE_TYPE = "extension.highlightFinding.clear.v1";

const HIGHLIGHT_STYLE_ID = "legal-tech-finding-highlight-style";
const CSS_HIGHLIGHT_KEY = "legal-tech-active-finding";
const FALLBACK_HIGHLIGHT_CLASS = "legal-tech-finding-highlight";

export interface HighlightFindingPayload {
  findingId: string;
  offsetStart: number;
  offsetEnd: number;
}

function ensureHighlightStyles(doc: Document) {
  if (doc.getElementById(HIGHLIGHT_STYLE_ID)) {
    return;
  }

  const style = doc.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    ::highlight(${CSS_HIGHLIGHT_KEY}) {
      background-color: rgba(250, 204, 21, 0.48);
      color: inherit;
    }

    .${FALLBACK_HIGHLIGHT_CLASS} {
      background-color: rgba(250, 204, 21, 0.48);
      color: inherit;
      border-radius: 0.2rem;
    }
  `;

  (doc.head ?? doc.documentElement).appendChild(style);
}

function resolveNodeByPath(root: Node, path: number[]) {
  let cursor: Node = root;

  for (const index of path) {
    const next = cursor.childNodes[index];
    if (!next) {
      return null;
    }
    cursor = next;
  }

  return cursor;
}

function toSourceOffset(span: ExtractedTextSpan, extractionOffset: number) {
  const normalizedSpanLength = span.end - span.start;
  const sourceSpanLength = span.sourceEnd - span.sourceStart;

  if (normalizedSpanLength <= 0 || sourceSpanLength <= 0) {
    return span.sourceStart;
  }

  const relative = (extractionOffset - span.start) / normalizedSpanLength;
  const projected = span.sourceStart + Math.round(relative * sourceSpanLength);

  return Math.min(span.sourceEnd, Math.max(span.sourceStart, projected));
}

function toRanges(
  doc: Document,
  extraction: DomExtractionResult,
  offsetStart: number,
  offsetEnd: number
) {
  const ranges: Range[] = [];
  const root = doc.body ?? doc.documentElement;

  for (const span of extraction.spans) {
    const intersectionStart = Math.max(offsetStart, span.start);
    const intersectionEnd = Math.min(offsetEnd, span.end);
    if (intersectionEnd <= intersectionStart) {
      continue;
    }

    const node = resolveNodeByPath(root, span.nodePath);
    if (!(node instanceof Text)) {
      continue;
    }

    const sourceStart = toSourceOffset(span, intersectionStart);
    const sourceEnd = toSourceOffset(span, intersectionEnd);
    if (sourceEnd <= sourceStart) {
      continue;
    }

    const range = doc.createRange();
    range.setStart(node, sourceStart);
    range.setEnd(node, sourceEnd);
    ranges.push(range);
  }

  return ranges;
}

function clearFallbackHighlights(doc: Document) {
  const nodes = Array.from(doc.querySelectorAll(`.${FALLBACK_HIGHLIGHT_CLASS}`));
  for (const node of nodes) {
    const parent = node.parentNode;
    if (!parent) {
      continue;
    }
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
  }
}

function applyFallbackHighlights(doc: Document, ranges: Range[]) {
  // Process ranges in reverse order so text node offsets stay valid while wrapping.
  const reversed = [...ranges].reverse();
  for (const range of reversed) {
    const wrapper = doc.createElement("span");
    wrapper.className = FALLBACK_HIGHLIGHT_CLASS;

    try {
      range.surroundContents(wrapper);
    } catch (_error) {
      continue;
    }
  }
}

export function clearFindingHighlights(doc: Document) {
  clearFallbackHighlights(doc);

  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    CSS.highlights.delete(CSS_HIGHLIGHT_KEY);
  }
}

export function highlightFindingOffsets(
  doc: Document,
  extraction: DomExtractionResult,
  payload: HighlightFindingPayload
) {
  ensureHighlightStyles(doc);
  clearFindingHighlights(doc);

  const safeStart = Math.max(0, payload.offsetStart);
  const safeEnd = Math.max(safeStart, payload.offsetEnd);
  const ranges = toRanges(doc, extraction, safeStart, safeEnd);

  if (ranges.length === 0) {
    return {
      highlighted: false,
      findingId: payload.findingId,
      highlightedRanges: 0
    };
  }

  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    const highlight = new Highlight(...ranges);
    CSS.highlights.set(CSS_HIGHLIGHT_KEY, highlight);
  } else {
    applyFallbackHighlights(doc, ranges);
  }

  // Scroll the first range into view to make highlight behavior obvious.
  ranges[0]?.startContainer.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });

  return {
    highlighted: true,
    findingId: payload.findingId,
    highlightedRanges: ranges.length
  };
}
