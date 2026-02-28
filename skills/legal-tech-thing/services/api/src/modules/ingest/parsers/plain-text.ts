import type { ParsedContractDocument } from "./types";

export async function parsePlainTextDocument(
  input: Buffer
): Promise<ParsedContractDocument> {
  return {
    parser: "text",
    text: input.toString("utf8"),
    metadata: {
      sourceFormat: "plain-text"
    }
  };
}
