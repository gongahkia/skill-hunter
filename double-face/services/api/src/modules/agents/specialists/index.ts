import type { AgentExecutor, AgentName } from "../runtime";

import { ambiguityAgent } from "./ambiguity";
import { complianceAgent } from "./compliance";
import { crossClauseConflictAgent } from "./cross-clause-conflict";
import { missingClauseAgent } from "./missing-clause";
import { riskScannerAgent } from "./risk-scanner";

export const specialistAgents: Record<AgentName, AgentExecutor> = {
  "risk-scanner": riskScannerAgent,
  "missing-clause": missingClauseAgent,
  ambiguity: ambiguityAgent,
  compliance: complianceAgent,
  "cross-clause-conflict": crossClauseConflictAgent,
  adjudicator: async () => ({
    findings: [],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }
  })
};
