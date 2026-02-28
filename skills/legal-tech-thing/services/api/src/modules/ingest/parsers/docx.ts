import type { ParsedContractDocument } from "./types";

export async function parseDocxDocument(input: Buffer): Promise<ParsedContractDocument> {
  return {
    parser: "docx",
    text: input.toString("utf8"),
    metadata: {
      sourceFormat: "docx"
    }
  };
}
