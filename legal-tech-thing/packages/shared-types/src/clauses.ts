import { z } from "zod";

export const clauseTypeSchema = z.enum([
  "definitions",
  "scope",
  "payment",
  "term",
  "termination",
  "liability",
  "indemnity",
  "ip",
  "confidentiality",
  "privacy",
  "governing-law",
  "dispute-resolution",
  "misc",
  "unknown"
]);

export const clauseSchema = z.object({
  id: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  type: clauseTypeSchema,
  heading: z.string().nullable(),
  text: z.string().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  pageNumber: z.number().int().min(1).nullable(),
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime()
});

export type Clause = z.infer<typeof clauseSchema>;
export type ClauseType = z.infer<typeof clauseTypeSchema>;
