import { z } from "zod";

export const findingSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info"
]);

export const findingStatusSchema = z.enum([
  "open",
  "accepted",
  "dismissed",
  "needs-edit"
]);

export const findingTypeSchema = z.enum([
  "risky-language",
  "missing-clause",
  "ambiguity",
  "compliance",
  "cross-clause-conflict"
]);

export const evidenceSpanSchema = z.object({
  versionId: z.string().uuid(),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  pageNumber: z.number().int().min(1).nullable(),
  excerpt: z.string().min(1)
});

export const findingSchema = z.object({
  id: z.string().uuid(),
  reviewRunId: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  type: findingTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  severity: findingSeveritySchema,
  confidence: z.number().min(0).max(1),
  status: findingStatusSchema,
  suggestedRedline: z.string().nullable(),
  evidence: evidenceSpanSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Finding = z.infer<typeof findingSchema>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type FindingStatus = z.infer<typeof findingStatusSchema>;
export type FindingType = z.infer<typeof findingTypeSchema>;
export type EvidenceSpan = z.infer<typeof evidenceSpanSchema>;
