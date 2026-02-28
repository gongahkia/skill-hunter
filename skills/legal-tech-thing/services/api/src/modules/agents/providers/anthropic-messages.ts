import {
  agentRuntimeOutputSchema,
  type AgentRuntimeOutput
} from "../runtime";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AnthropicMessagesAdapterConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  maxTokens?: number;
};

export type AnthropicMessagesRequest = {
  messages: ChatMessage[];
};

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(statusCode: number) {
  return statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

function parseAnthropicText(json: Record<string, unknown>) {
  const content = json.content as Array<Record<string, unknown>> | undefined;
  const textBlock = content?.find(
    (item) => item.type === "text" && typeof item.text === "string"
  );

  if (!textBlock || typeof textBlock.text !== "string") {
    throw new Error("ANTHROPIC_INVALID_CONTENT");
  }

  return textBlock.text;
}

export class AnthropicMessagesAdapter {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly model: string;

  private readonly maxRetries: number;

  private readonly timeoutMs: number;

  private readonly maxTokens: number;

  constructor(config: AnthropicMessagesAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY_MISSING");
    }

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? DEFAULT_BASE_URL;
    this.model = config.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(request: AnthropicMessagesRequest): Promise<AgentRuntimeOutput> {
    const systemText = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const userAndAssistantMessages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    const payload = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemText,
      messages: userAndAssistantMessages
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxRetries) {
      attempt += 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (shouldRetry(response.status) && attempt < this.maxRetries) {
            await sleep(2 ** attempt * 250);
            continue;
          }

          const errorBody = await response.text();
          throw new Error(`ANTHROPIC_MESSAGES_FAILED:${response.status}:${errorBody}`);
        }

        const json = (await response.json()) as Record<string, unknown>;
        const content = parseAnthropicText(json);
        const parsedContent = JSON.parse(content) as Record<string, unknown>;

        return agentRuntimeOutputSchema.parse(parsedContent);
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt >= this.maxRetries) {
          break;
        }

        await sleep(2 ** attempt * 250);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("ANTHROPIC_MESSAGES_RETRIES_EXHAUSTED");
  }
}
