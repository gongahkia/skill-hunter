export type ParsedContractDocument = {
  parser: "html" | "pdf" | "docx" | "image" | "text";
  text: string;
  pageCount?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ContractParser = (input: Buffer) => Promise<ParsedContractDocument>;
