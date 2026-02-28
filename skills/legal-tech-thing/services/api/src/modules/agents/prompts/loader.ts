import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { agentNameSchema, type AgentName } from "../runtime";

const PROMPT_ROOT_DIR = path.resolve(process.cwd(), "services/api/prompts");
const DEFAULT_PROMPT_VERSION = "v1";

export type PromptRenderContext = Record<string, string | number | boolean | null>;

function getPromptFilePath(version: string, agentName: AgentName) {
  return path.join(PROMPT_ROOT_DIR, version, `${agentName}.md`);
}

function renderTemplate(template: string, context: PromptRenderContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];

    if (value === undefined || value === null) {
      return "";
    }

    return String(value);
  });
}

export async function listPromptVersions() {
  const entries = await readdir(PROMPT_ROOT_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function loadAgentPromptTemplate(
  agentName: string,
  version = DEFAULT_PROMPT_VERSION
) {
  const parsedAgentName = agentNameSchema.parse(agentName);
  const promptFilePath = getPromptFilePath(version, parsedAgentName);

  await access(promptFilePath);

  return readFile(promptFilePath, "utf8");
}

export async function renderAgentPromptTemplate(
  agentName: string,
  context: PromptRenderContext,
  version = DEFAULT_PROMPT_VERSION
) {
  const template = await loadAgentPromptTemplate(agentName, version);
  return renderTemplate(template, context);
}
