import type { ParsedContractDocument } from "./types";

export async function parseImageDocument(input: Buffer): Promise<ParsedContractDocument> {
  return {
    parser: "image",
    text: input.toString("utf8"),
    metadata: {
      sourceFormat: "image"
    }
  };
}
