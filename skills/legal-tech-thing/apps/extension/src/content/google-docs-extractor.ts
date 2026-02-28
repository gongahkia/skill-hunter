import type { DomExtractionResult } from "./dom-extractor";

const GOOGLE_DOCS_HOSTNAME = "docs.google.com";
const GOOGLE_DOCS_DOCUMENT_PATH_PREFIX = "/document/";
const GOOGLE_DOCS_EDITOR_SELECTORS = [
  "div.kix-appview-editor",
  "div.docs-texteventtarget-iframe",
  "div[role='textbox']"
];
const GOOGLE_DOCS_TITLE_SUFFIX_PATTERN = /\s*-\s*Google Docs\s*$/i;
const MAX_EXTRACTED_CHARS = 90_000;

function isGoogleDocsDocument(pageUrl: string) {
  try {
    const url = new URL(pageUrl);
    return (
      url.hostname.toLowerCase() === GOOGLE_DOCS_HOSTNAME &&
      url.pathname.toLowerCase().startsWith(GOOGLE_DOCS_DOCUMENT_PATH_PREFIX)
    );
  } catch (_error) {
    return false;
  }
}

function getGoogleDocsTitle(doc: Document) {
  const rawTitle = doc.title?.trim() ?? "";
  if (!rawTitle) {
    return "Google Docs capture";
  }

  const normalized = rawTitle.replace(GOOGLE_DOCS_TITLE_SUFFIX_PATTERN, "").trim();
  return normalized || rawTitle;
}

function restoreSelection(doc: Document, ranges: Range[]) {
  const selection = doc.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  for (const range of ranges) {
    selection.addRange(range);
  }
}

function normalizeCopiedText(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attemptGoogleDocsCopyExtraction(doc: Document) {
  const selection = doc.getSelection();
  const selectionSnapshot: Range[] = [];

  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index);
      selectionSnapshot.push(range.cloneRange());
    }
  }

  const previousActiveElement = doc.activeElement as HTMLElement | null;
  const editorRoot = doc.querySelector<HTMLElement>(GOOGLE_DOCS_EDITOR_SELECTORS.join(", "));
  if (editorRoot) {
    editorRoot.focus();
  }

  let copiedText = "";
  const handleCopy = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (text.trim()) {
      copiedText = text;
    }
  };

  doc.addEventListener("copy", handleCopy, true);
  try {
    doc.execCommand("selectAll");
    doc.execCommand("copy");
    if (!copiedText.trim()) {
      copiedText = doc.getSelection()?.toString() ?? "";
    }
  } finally {
    doc.removeEventListener("copy", handleCopy, true);
    restoreSelection(doc, selectionSnapshot);
    previousActiveElement?.focus();
  }

  return normalizeCopiedText(copiedText);
}

export function extractGoogleDocsTextByCopyFallback(
  doc: Document,
  pageUrl: string,
  legalSignalLabels: string[]
): DomExtractionResult | null {
  if (!isGoogleDocsDocument(pageUrl) || legalSignalLabels.length === 0) {
    return null;
  }

  const copiedText = attemptGoogleDocsCopyExtraction(doc);
  if (!copiedText) {
    return null;
  }

  const boundedText = copiedText.slice(0, MAX_EXTRACTED_CHARS);
  const truncated = copiedText.length > boundedText.length;

  return {
    url: pageUrl,
    title: getGoogleDocsTitle(doc),
    extractedText: boundedText,
    spans: [],
    extractedCharacters: boundedText.length,
    truncated,
    extractedAt: new Date().toISOString()
  };
}
