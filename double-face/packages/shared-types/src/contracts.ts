import { z } from "zod";

export const contractSourceTypeSchema = z.enum([
  "upload",
  "web",
  "extension-dom",
  "desktop-screen",
  "clipboard"
]);

export const contractProcessingStatusSchema = z.enum([
  "created",
  "uploading",
  "queued",
  "ingesting",
  "ready",
  "failed"
]);

export const contractSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().min(1),
  sourceType: contractSourceTypeSchema,
  status: contractProcessingStatusSchema,
  latestVersionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const contractVersionSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  checksum: z.string().min(1),
  storageUri: z.string().min(1),
  parser: z.string().min(1),
  parserConfidence: z.number().min(0).max(1),
  createdAt: z.string().datetime()
});

export type Contract = z.infer<typeof contractSchema>;
export type ContractVersion = z.infer<typeof contractVersionSchema>;
export type ContractSourceType = z.infer<typeof contractSourceTypeSchema>;
export type ContractProcessingStatus = z.infer<
  typeof contractProcessingStatusSchema
>;
