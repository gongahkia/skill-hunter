import type { CompiledPolicy, CompiledRule, PolicySeverity } from "./types.js";

type MutableRule = {
  id: string;
  clauseType: string | null;
  requirePattern: string | null;
  requireFlags: string | null;
  forbidPattern: string | null;
  forbidFlags: string | null;
  severity: PolicySeverity | null;
  remediation: string | null;
};

function createEmptyRule(id: string): MutableRule {
  return {
    id,
    clauseType: null,
    requirePattern: null,
    requireFlags: null,
    forbidPattern: null,
    forbidFlags: null,
    severity: null,
    remediation: null
  };
}

function parseQuotedValue(raw: string, lineNo: number) {
  const quotedMatch = raw.match(/^"([\s\S]*)"$/);
  if (!quotedMatch) {
    throw new Error(`Line ${lineNo}: expected quoted string`);
  }

  return quotedMatch[1] ?? "";
}

function parseRegexLiteral(raw: string, lineNo: number) {
  const match = raw.match(/^\/(.+)\/([a-z]*)$/i);
  if (!match) {
    throw new Error(`Line ${lineNo}: expected regex literal like /pattern/i`);
  }

  const pattern = match[1] ?? "";
  const flags = match[2] ?? "";

  try {
    // Validate regex validity.
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags);
  } catch {
    throw new Error(`Line ${lineNo}: invalid regex literal ${raw}`);
  }

  return { pattern, flags };
}

function finalizeRule(rule: MutableRule, lineNo: number): CompiledRule {
  if (!rule.clauseType) {
    throw new Error(`Line ${lineNo}: RULE ${rule.id} missing WHEN CLAUSE TYPE ...`);
  }

  if (!rule.requirePattern && !rule.forbidPattern) {
    throw new Error(`Line ${lineNo}: RULE ${rule.id} needs REQUIRE and/or FORBID`);
  }

  if (!rule.severity) {
    throw new Error(`Line ${lineNo}: RULE ${rule.id} missing SEVERITY`);
  }

  return {
    id: rule.id,
    clauseType: rule.clauseType,
    requirePattern: rule.requirePattern,
    requireFlags: rule.requireFlags,
    forbidPattern: rule.forbidPattern,
    forbidFlags: rule.forbidFlags,
    severity: rule.severity,
    remediation: rule.remediation ?? "Update clause to satisfy policy controls."
  };
}

export function compilePolicyDsl(dslText: string): CompiledPolicy {
  const lines = dslText.split(/\r?\n/g);
  let policyName = "Untitled Policy";
  let currentRule: MutableRule | null = null;
  const rules: CompiledRule[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const raw = lines[index] ?? "";
    const line = raw.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("POLICY ")) {
      policyName = parseQuotedValue(line.slice("POLICY ".length).trim(), lineNo);
      continue;
    }

    if (line.startsWith("RULE ")) {
      if (currentRule) {
        throw new Error(`Line ${lineNo}: previous RULE ${currentRule.id} not closed with END`);
      }

      const id = line.slice("RULE ".length).trim();
      if (!id) {
        throw new Error(`Line ${lineNo}: RULE requires an identifier`);
      }

      currentRule = createEmptyRule(id);
      continue;
    }

    if (!currentRule) {
      throw new Error(`Line ${lineNo}: statement outside RULE block`);
    }

    if (line.startsWith("WHEN CLAUSE TYPE ")) {
      const clauseType = line.slice("WHEN CLAUSE TYPE ".length).trim();
      if (!clauseType) {
        throw new Error(`Line ${lineNo}: WHEN CLAUSE TYPE requires value`);
      }
      currentRule.clauseType = clauseType.toUpperCase();
      continue;
    }

    if (line.startsWith("REQUIRE ")) {
      const regex = parseRegexLiteral(line.slice("REQUIRE ".length).trim(), lineNo);
      currentRule.requirePattern = regex.pattern;
      currentRule.requireFlags = regex.flags;
      continue;
    }

    if (line.startsWith("FORBID ")) {
      const regex = parseRegexLiteral(line.slice("FORBID ".length).trim(), lineNo);
      currentRule.forbidPattern = regex.pattern;
      currentRule.forbidFlags = regex.flags;
      continue;
    }

    if (line.startsWith("SEVERITY ")) {
      const severity = line.slice("SEVERITY ".length).trim().toLowerCase();
      if (!["critical", "high", "medium", "low", "info"].includes(severity)) {
        throw new Error(`Line ${lineNo}: invalid severity ${severity}`);
      }
      currentRule.severity = severity as PolicySeverity;
      continue;
    }

    if (line.startsWith("REMEDIATION ")) {
      currentRule.remediation = parseQuotedValue(line.slice("REMEDIATION ".length).trim(), lineNo);
      continue;
    }

    if (line === "END") {
      rules.push(finalizeRule(currentRule, lineNo));
      currentRule = null;
      continue;
    }

    throw new Error(`Line ${lineNo}: unsupported statement '${line}'`);
  }

  if (currentRule) {
    throw new Error(`Unclosed RULE ${currentRule.id}; expected END`);
  }

  if (rules.length === 0) {
    throw new Error("No rules compiled from DSL");
  }

  return {
    policyName,
    compiledAt: new Date().toISOString(),
    rules
  };
}
