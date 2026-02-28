export type ParsedContractDocument = {
  parser: "html" | "pdf" | "docx" | "image" | "text";
  text: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
};

export type ContractParser = (input: Buffer) => Promise<ParsedContractDocument>;
