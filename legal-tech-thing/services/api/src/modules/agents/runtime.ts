import { z } from "zod";

export const agentNameSchema = z.enum([
  "risk-scanner",
  "missing-clause",
  "ambiguity",
  "compliance",
  "cross-clause-conflict",
  "adjudicator"
]);

export const agentClauseInputSchema = z
  .object({
    id: z.string().uuid(),
    heading: z.string().nullable(),
    type: z.string(),
    text: z.string().min(1),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0)
  })
  .strict();

export const agentRuntimeInputSchema = z
  .object({
    contractId: z.string().uuid(),
    contractVersionId: z.string().uuid(),
    reviewRunId: z.string().uuid(),
    contractType: z.string().min(1).optional(),
    jurisdiction: z.string().min(1).optional(),
    language: z.string().min(2),
    policyProfileId: z.string().uuid(),
    policyRules: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            clauseRequirement: z.string().nullable(),
            clauseSelector: z.string().min(1),
            requiredPattern: z.string().nullable(),
            forbiddenPattern: z.string().nullable(),
            allowException: z.boolean(),
            active: z.boolean(),
            priority: z.number().int().positive().default(100)
          })
          .strict()
      )
      .default([]),
    clauses: z.array(agentClauseInputSchema)
  })
  .strict();

export const agentEvidenceSchema = z
  .object({
    clauseId: z.string().uuid().nullable(),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
    excerpt: z.string().min(1)
  })
  .strict();

export const agentFindingOutputSchema = z
  .object({
    type: z.enum([
      "risky-language",
      "missing-clause",
      "ambiguity",
      "compliance",
      "cross-clause-conflict"
    ]),
    title: z.string().min(1),
    description: z.string().min(1),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    confidence: z.number().min(0).max(1),
    suggestedRedline: z.string().nullable(),
    evidence: z.array(agentEvidenceSchema).min(1)
  })
  .strict();

export const agentRuntimeOutputSchema = z
  .object({
    findings: z.array(agentFindingOutputSchema),
    usage: z
      .object({
        promptTokens: z.number().int().nonnegative(),
        completionTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative()
      })
      .strict()
      .optional()
  })
  .strict();

export type AgentName = z.infer<typeof agentNameSchema>;
export type AgentRuntimeInput = z.infer<typeof agentRuntimeInputSchema>;
export type AgentRuntimeOutput = z.infer<typeof agentRuntimeOutputSchema>;
export type AgentExecutor = (
  input: AgentRuntimeInput
) => Promise<AgentRuntimeOutput | unknown>;

export class AgentRuntime {
  private readonly registry = new Map<AgentName, AgentExecutor>();

  register(name: AgentName, executor: AgentExecutor) {
    this.registry.set(name, executor);
  }

  has(name: AgentName) {
    return this.registry.has(name);
  }

  async run(name: AgentName, input: AgentRuntimeInput): Promise<AgentRuntimeOutput> {
    const executor = this.registry.get(name);

    if (!executor) {
      throw new Error(`AGENT_NOT_REGISTERED:${name}`);
    }

    const validInput = agentRuntimeInputSchema.parse(input);
    const rawOutput = await executor(validInput);

    return agentRuntimeOutputSchema.parse(rawOutput);
  }
}
