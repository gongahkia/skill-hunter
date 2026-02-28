import type { ParsedContractDocument } from "./types";

function normalizeText(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export async function parsePlainTextDocument(
  input: Buffer
): Promise<ParsedContractDocument> {
  const text = normalizeText(input.toString("utf8"));

  return {
    parser: "text",
    text,
    metadata: {
      sourceFormat: "plain-text"
    }
  };
}
