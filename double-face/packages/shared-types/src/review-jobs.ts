import { z } from "zod";

import { llmProviderSchema } from "./policies";

export const reviewRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const reviewAgentNameSchema = z.enum([
  "risk-scanner",
  "missing-clause",
  "ambiguity",
  "compliance",
  "cross-clause-conflict",
  "adjudicator"
]);

export const reviewRunSchema = z.object({
  id: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid(),
  provider: llmProviderSchema,
  status: reviewRunStatusSchema,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string().datetime()
});

export const reviewJobPayloadSchema = z.object({
  reviewRunId: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid(),
  provider: llmProviderSchema,
  agents: z.array(reviewAgentNameSchema).min(1)
});

export type ReviewRun = z.infer<typeof reviewRunSchema>;
export type ReviewRunStatus = z.infer<typeof reviewRunStatusSchema>;
export type ReviewAgentName = z.infer<typeof reviewAgentNameSchema>;
export type ReviewJobPayload = z.infer<typeof reviewJobPayloadSchema>;
