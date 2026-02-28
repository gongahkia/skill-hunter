import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12)
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1)
});

export const createContractBodySchema = z.object({
  title: z.string().min(1).max(255),
  sourceType: z.enum(["UPLOAD", "WEB", "EXTENSION_DOM", "DESKTOP_SCREEN", "CLIPBOARD"])
});

export const contractIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const contractSourceDownloadQuerySchema = z.object({
  versionId: z.string().uuid().optional()
});

export const createUploadUrlBodySchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  contentLength: z.number().int().positive().max(100 * 1024 * 1024)
});

export const ingestContractBodySchema = z.object({
  objectUri: z.string().min(1),
  objectKey: z.string().min(1),
  mimeType: z.string().min(1).max(255),
  contentLength: z.number().int().positive().max(100 * 1024 * 1024),
  checksum: z.string().min(1)
});

export const contractFindingsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  status: z.enum(["open", "accepted", "dismissed", "needs-edit"]).optional()
});

export const createReviewBodySchema = z.object({
  contractVersionId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA"]).optional(),
  selectedAgents: z.array(z.string().min(1)).min(1).optional()
});

export const reviewIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const findingIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const updateFindingBodySchema = z.object({
  status: z.enum(["open", "accepted", "dismissed", "needs-edit"])
});

export const createFeedbackBodySchema = z.object({
  action: z.enum(["accepted", "dismissed", "edited"]).optional(),
  rationale: z.string().min(1),
  correctedSeverity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  correctedTitle: z.string().min(1).max(255).optional()
});
