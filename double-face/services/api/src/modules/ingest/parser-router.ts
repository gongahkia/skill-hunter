import { parseDocxDocument } from "./parsers/docx";
import { parseHtmlDocument } from "./parsers/html";
import { parseImageDocument } from "./parsers/image";
import { parsePdfDocument } from "./parsers/pdf";
import { parsePlainTextDocument } from "./parsers/plain-text";
import type { ContractParser, ParsedContractDocument } from "./parsers/types";

const htmlMimeTypes = new Set(["text/html", "application/xhtml+xml"]);
const pdfMimeTypes = new Set(["application/pdf"]);
const docxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const additionalTextMimeTypes = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/x-www-form-urlencoded",
  "application/rtf"
]);

function isUnknownTextMimeType(mimeType: string) {
  if (mimeType.startsWith("text/")) {
    return true;
  }

  if (additionalTextMimeTypes.has(mimeType)) {
    return true;
  }

  if (mimeType.startsWith("application/") && mimeType.endsWith("+json")) {
    return true;
  }

  if (mimeType.startsWith("application/") && mimeType.endsWith("+xml")) {
    return true;
  }

  return false;
}

function getParserForMimeType(mimeType: string): ContractParser {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (htmlMimeTypes.has(normalizedMimeType)) {
    return parseHtmlDocument;
  }

  if (pdfMimeTypes.has(normalizedMimeType)) {
    return parsePdfDocument;
  }

  if (docxMimeTypes.has(normalizedMimeType)) {
    return parseDocxDocument;
  }

  if (normalizedMimeType.startsWith("image/")) {
    return parseImageDocument;
  }

  if (isUnknownTextMimeType(normalizedMimeType)) {
    return parsePlainTextDocument;
  }

  throw new Error(`UNSUPPORTED_MIME_TYPE:${normalizedMimeType}`);
}

export async function parseContractByMimeType(
  mimeType: string,
  input: Buffer
): Promise<ParsedContractDocument> {
  const parser = getParserForMimeType(mimeType);
  return parser(input);
}
