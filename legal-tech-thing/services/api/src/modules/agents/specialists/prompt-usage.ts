import {
  renderLocalizedAgentPromptTemplate
} from "../prompts/loader";
import type { AgentName, AgentRuntimeInput, AgentRuntimeOutput } from "../runtime";

function estimatePromptTokens(text: string) {
  // Coarse estimate aligned with common tokenizer heuristics.
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export async function resolveSpecialistPromptUsage(
  agentName: Extract<
    AgentName,
    "risk-scanner" | "missing-clause" | "ambiguity" | "compliance" | "cross-clause-conflict"
  >,
  input: AgentRuntimeInput
) {
  const renderedPrompt = await renderLocalizedAgentPromptTemplate(
    agentName,
    {
      contractLanguage: input.language,
      contractType: input.contractType ?? "",
      jurisdiction: input.jurisdiction ?? "",
      clauseCount: input.clauses.length
    },
    {
      language: input.language
    }
  );

  const promptTokens = estimatePromptTokens(renderedPrompt.prompt);
  const usage: NonNullable<AgentRuntimeOutput["usage"]> = {
    promptTokens,
    completionTokens: 0,
    totalTokens: promptTokens
  };

  return {
    prompt: renderedPrompt.prompt,
    promptLanguage: renderedPrompt.language,
    usage
  };
}
