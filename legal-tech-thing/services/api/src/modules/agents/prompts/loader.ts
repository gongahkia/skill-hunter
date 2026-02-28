import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { agentNameSchema, type AgentName } from "../runtime";

const PROMPT_ROOT_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "services/api/prompts"),
  path.resolve(process.cwd(), "prompts")
];
const DEFAULT_PROMPT_VERSION = "v1";
let cachedPromptRootDir: string | null = null;

export type PromptRenderContext = Record<string, string | number | boolean | null>;
export type PromptTemplateResolution = {
  template: string;
  language: string;
};

function getPromptFilePath(promptRootDir: string, version: string, agentName: AgentName) {
  return path.join(promptRootDir, version, `${agentName}.md`);
}

function getLocalizedPromptFilePath(
  promptRootDir: string,
  version: string,
  language: string,
  agentName: AgentName
) {
  return path.join(promptRootDir, version, "locales", language, `${agentName}.md`);
}

function normalizeLanguageTag(language: string) {
  return language.trim().toLowerCase().replace(/_/g, "-");
}

function buildPromptLanguageCandidates(language?: string | null) {
  const candidates = new Set<string>();
  const normalized = typeof language === "string" ? normalizeLanguageTag(language) : "";

  if (normalized) {
    candidates.add(normalized);

    const [baseLanguage] = normalized.split("-");
    if (baseLanguage) {
      candidates.add(baseLanguage);
    }
  }

  candidates.add("en");
  return Array.from(candidates);
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

async function resolvePromptRootDir() {
  if (cachedPromptRootDir) {
    return cachedPromptRootDir;
  }

  for (const candidate of PROMPT_ROOT_DIR_CANDIDATES) {
    try {
      await access(candidate);
      cachedPromptRootDir = candidate;
      return cachedPromptRootDir;
    } catch (_error) {
      continue;
    }
  }

  throw new Error("PROMPT_ROOT_DIR_NOT_FOUND");
}

export async function listPromptVersions() {
  const promptRootDir = await resolvePromptRootDir();
  const entries = await readdir(promptRootDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function loadAgentPromptTemplate(
  agentName: string,
  version = DEFAULT_PROMPT_VERSION
) {
  const promptRootDir = await resolvePromptRootDir();
  const parsedAgentName = agentNameSchema.parse(agentName);
  const promptFilePath = getPromptFilePath(promptRootDir, version, parsedAgentName);

  await access(promptFilePath);

  return readFile(promptFilePath, "utf8");
}

export async function loadLocalizedAgentPromptTemplate(
  agentName: string,
  options: {
    version?: string;
    language?: string | null;
  } = {}
): Promise<PromptTemplateResolution> {
  const promptRootDir = await resolvePromptRootDir();
  const parsedAgentName = agentNameSchema.parse(agentName);
  const version = options.version ?? DEFAULT_PROMPT_VERSION;
  const languageCandidates = buildPromptLanguageCandidates(options.language);

  for (const language of languageCandidates) {
    const promptFilePath =
      language === "en"
        ? getPromptFilePath(promptRootDir, version, parsedAgentName)
        : getLocalizedPromptFilePath(promptRootDir, version, language, parsedAgentName);

    try {
      await access(promptFilePath);
      const template = await readFile(promptFilePath, "utf8");
      return {
        template,
        language
      };
    } catch (_error) {
      continue;
    }
  }

  throw new Error(`PROMPT_TEMPLATE_NOT_FOUND:${parsedAgentName}`);
}

export async function renderAgentPromptTemplate(
  agentName: string,
  context: PromptRenderContext,
  version = DEFAULT_PROMPT_VERSION
) {
  const template = await loadAgentPromptTemplate(agentName, version);
  return renderTemplate(template, context);
}

export async function renderLocalizedAgentPromptTemplate(
  agentName: string,
  context: PromptRenderContext,
  options: {
    version?: string;
    language?: string | null;
  } = {}
) {
  const resolution = await loadLocalizedAgentPromptTemplate(agentName, options);

  return {
    prompt: renderTemplate(resolution.template, context),
    language: resolution.language
  };
}
