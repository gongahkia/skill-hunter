import {
  agentRuntimeOutputSchema,
  type AgentRuntimeOutput
} from "../runtime";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAiChatAdapterConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  temperature?: number;
};

export type OpenAiChatRequest = {
  messages: ChatMessage[];
  responseFormat?: {
    type: "json_object";
  };
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";
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

function parseResponseContent(json: Record<string, unknown>) {
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const firstPart = content.find(
      (part) => typeof part === "object" && part && "text" in part
    ) as { text?: string } | undefined;

    if (typeof firstPart?.text === "string") {
      return firstPart.text;
    }
  }

  throw new Error("OPENAI_INVALID_CONTENT");
}

export class OpenAiChatAdapter {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly model: string;

  private readonly maxRetries: number;

  private readonly timeoutMs: number;

  private readonly temperature: number;

  constructor(config: OpenAiChatAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY_MISSING");
    }

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
    this.model = config.model ?? process.env.OPENAI_CHAT_MODEL ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.temperature = config.temperature ?? 0;
  }

  async generate(request: OpenAiChatRequest): Promise<AgentRuntimeOutput> {
    const payload = {
      model: this.model,
      temperature: this.temperature,
      messages: request.messages,
      response_format: request.responseFormat ?? { type: "json_object" }
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxRetries) {
      attempt += 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`
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
          throw new Error(`OPENAI_CHAT_FAILED:${response.status}:${errorBody}`);
        }

        const json = (await response.json()) as Record<string, unknown>;
        const content = parseResponseContent(json);
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
      : new Error("OPENAI_CHAT_RETRIES_EXHAUSTED");
  }
}
