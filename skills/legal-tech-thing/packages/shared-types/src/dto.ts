import { z } from "zod";

import { contractSchema, contractVersionSchema } from "./contracts";
import { findingSchema, findingStatusSchema } from "./findings";
import {
  llmProviderSchema,
  policyProfileSchema,
  policyRuleSchema
} from "./policies";
import { reviewRunSchema } from "./review-jobs";

export const createContractRequestDtoSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum([
    "upload",
    "web",
    "extension-dom",
    "desktop-screen",
    "clipboard"
  ])
});

export const createContractResponseDtoSchema = z.object({
  contract: contractSchema,
  contractVersion: contractVersionSchema
});

export const createUploadUrlRequestDtoSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentLength: z.number().int().positive()
});

export const createUploadUrlResponseDtoSchema = z.object({
  uploadUrl: z.string().url(),
  objectUri: z.string().min(1),
  expiresInSeconds: z.number().int().positive()
});

export const startReviewRequestDtoSchema = z.object({
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid(),
  provider: llmProviderSchema
});

export const startReviewResponseDtoSchema = z.object({
  reviewRun: reviewRunSchema
});

export const listFindingsResponseDtoSchema = z.object({
  items: z.array(findingSchema),
  nextCursor: z.string().nullable()
});

export const updateFindingStatusRequestDtoSchema = z.object({
  status: findingStatusSchema
});

export const createFindingFeedbackRequestDtoSchema = z.object({
  rationale: z.string().min(1),
  correctedSeverity: z
    .enum(["critical", "high", "medium", "low", "info"])
    .optional(),
  correctedTitle: z.string().min(1).optional()
});

export const upsertPolicyProfileRequestDtoSchema = policyProfileSchema.pick({
  name: true,
  defaultProvider: true,
  enabledAgents: true,
  thresholds: true
});

export const createPolicyRuleRequestDtoSchema = policyRuleSchema.pick({
  name: true,
  priority: true,
  clauseSelector: true,
  requiredPattern: true,
  forbiddenPattern: true,
  allowException: true,
  active: true
});

export type CreateContractRequestDto = z.infer<
  typeof createContractRequestDtoSchema
>;
export type CreateContractResponseDto = z.infer<
  typeof createContractResponseDtoSchema
>;
export type CreateUploadUrlRequestDto = z.infer<
  typeof createUploadUrlRequestDtoSchema
>;
export type CreateUploadUrlResponseDto = z.infer<
  typeof createUploadUrlResponseDtoSchema
>;
export type StartReviewRequestDto = z.infer<typeof startReviewRequestDtoSchema>;
export type StartReviewResponseDto = z.infer<typeof startReviewResponseDtoSchema>;
export type ListFindingsResponseDto = z.infer<typeof listFindingsResponseDtoSchema>;
export type UpdateFindingStatusRequestDto = z.infer<
  typeof updateFindingStatusRequestDtoSchema
>;
export type CreateFindingFeedbackRequestDto = z.infer<
  typeof createFindingFeedbackRequestDtoSchema
>;
export type UpsertPolicyProfileRequestDto = z.infer<
  typeof upsertPolicyProfileRequestDtoSchema
>;
export type CreatePolicyRuleRequestDto = z.infer<
  typeof createPolicyRuleRequestDtoSchema
>;
