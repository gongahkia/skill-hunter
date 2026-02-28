import { LlmProvider, type PolicyProfile } from "@prisma/client";

import { AnthropicMessagesAdapter } from "./anthropic-messages";
import { GeminiGenerateAdapter } from "./gemini-generate";
import { OllamaChatAdapter } from "./ollama-chat";
import { OpenAiChatAdapter } from "./openai-chat";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AgentChatRequest = {
  messages: ChatMessage[];
};

export type AgentProviderAdapter = {
  name: string;
  generate: (request: AgentChatRequest) => Promise<unknown>;
};

function buildProviderAdapter(provider: LlmProvider): AgentProviderAdapter {
  if (provider === LlmProvider.OPENAI) {
    return {
      name: "openai",
      generate: (request) => new OpenAiChatAdapter().generate(request)
    };
  }

  if (provider === LlmProvider.ANTHROPIC) {
    return {
      name: "anthropic",
      generate: (request) => new AnthropicMessagesAdapter().generate(request)
    };
  }

  if (provider === LlmProvider.GEMINI) {
    return {
      name: "gemini",
      generate: (request) => new GeminiGenerateAdapter().generate(request)
    };
  }

  if (provider === LlmProvider.OLLAMA) {
    return {
      name: "ollama",
      generate: (request) => new OllamaChatAdapter().generate(request)
    };
  }

  throw new Error(`UNSUPPORTED_PROVIDER:${provider}`);
}

export class AgentProviderRegistry {
  private readonly cache = new Map<LlmProvider, AgentProviderAdapter>();

  resolve(provider: LlmProvider): AgentProviderAdapter {
    const existing = this.cache.get(provider);

    if (existing) {
      return existing;
    }

    const adapter = buildProviderAdapter(provider);
    this.cache.set(provider, adapter);

    return adapter;
  }

  resolveFromPolicyProfile(
    profile: Pick<PolicyProfile, "defaultProvider">
  ): AgentProviderAdapter {
    return this.resolve(profile.defaultProvider);
  }
}
