import type { ParsedContractDocument } from "./types";

export async function parsePdfDocument(input: Buffer): Promise<ParsedContractDocument> {
  return {
    parser: "pdf",
    text: input.toString("utf8"),
    metadata: {
      sourceFormat: "pdf"
    }
  };
}
