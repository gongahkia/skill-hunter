import { adjudicateFindings, type SourcedFinding } from "./adjudication";
import {
  AgentRuntime,
  type AgentName,
  type AgentRuntimeInput,
  type AgentRuntimeOutput
} from "./runtime";
import { specialistAgents } from "./specialists";

export type AgentRunResult = {
  agent: AgentName;
  status: "completed" | "failed";
  output?: AgentRuntimeOutput;
  error?: string;
};

export type OrchestrationResult = {
  reviewRunId: string;
  agentResults: AgentRunResult[];
  rawFindings: SourcedFinding[];
  findings: Array<AgentRuntimeOutput["findings"][number] & { sourceAgents: AgentName[] }>;
};

const defaultSpecialistAgentOrder: AgentName[] = [
  "risk-scanner",
  "missing-clause",
  "ambiguity",
  "compliance",
  "cross-clause-conflict"
];

function buildAgentRuntime() {
  const runtime = new AgentRuntime();

  for (const [name, executor] of Object.entries(specialistAgents)) {
    runtime.register(name as AgentName, executor);
  }

  return runtime;
}

export async function runSpecialistAgentsForReview(
  input: AgentRuntimeInput,
  selectedAgents: AgentName[] = defaultSpecialistAgentOrder
): Promise<OrchestrationResult> {
  const runtime = buildAgentRuntime();

  const tasks = selectedAgents.map(async (agent): Promise<AgentRunResult> => {
    try {
      const output = await runtime.run(agent, input);

      return {
        agent,
        status: "completed",
        output
      };
    } catch (error) {
      return {
        agent,
        status: "failed",
        error: error instanceof Error ? error.message : "UNKNOWN_AGENT_ERROR"
      };
    }
  });

  const agentResults = await Promise.all(tasks);

  const rawFindings = agentResults.flatMap((result) => {
    if (result.status !== "completed" || !result.output) {
      return [];
    }

    return result.output.findings.map((finding) => ({
      ...finding,
      sourceAgent: result.agent
    }));
  });

  const findings = adjudicateFindings(rawFindings);

  return {
    reviewRunId: input.reviewRunId,
    agentResults,
    rawFindings,
    findings
  };
}
