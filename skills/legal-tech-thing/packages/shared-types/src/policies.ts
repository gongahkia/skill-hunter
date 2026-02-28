import { z } from "zod";

export const llmProviderSchema = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "ollama"
]);

export const policyThresholdsSchema = z.object({
  criticalMinConfidence: z.number().min(0).max(1),
  highMinConfidence: z.number().min(0).max(1),
  mediumMinConfidence: z.number().min(0).max(1),
  autoEscalateSeverity: z.enum(["critical", "high", "medium", "low", "info"])
});

export const policyProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  defaultProvider: llmProviderSchema,
  enabledAgents: z
    .object({
      riskScanner: z.boolean(),
      missingClause: z.boolean(),
      ambiguity: z.boolean(),
      compliance: z.boolean(),
      crossClauseConflict: z.boolean()
    })
    .strict(),
  thresholds: policyThresholdsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const policyRuleSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  name: z.string().min(1),
  priority: z.number().int().min(1),
  clauseSelector: z.string().min(1),
  requiredPattern: z.string().nullable(),
  forbiddenPattern: z.string().nullable(),
  allowException: z.boolean(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type LlmProvider = z.infer<typeof llmProviderSchema>;
export type PolicyProfile = z.infer<typeof policyProfileSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type PolicyThresholds = z.infer<typeof policyThresholdsSchema>;
