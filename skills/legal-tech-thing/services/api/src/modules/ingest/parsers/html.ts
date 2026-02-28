import type { ParsedContractDocument } from "./types";

export async function parseHtmlDocument(input: Buffer): Promise<ParsedContractDocument> {
  return {
    parser: "html",
    text: input.toString("utf8"),
    metadata: {
      sourceFormat: "html"
    }
  };
}
