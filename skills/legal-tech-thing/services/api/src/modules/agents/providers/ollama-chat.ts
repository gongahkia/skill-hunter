import {
  agentRuntimeOutputSchema,
  type AgentRuntimeOutput
} from "../runtime";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatAdapterConfig = {
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

export type OllamaChatRequest = {
  messages: ChatMessage[];
};

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1:8b-instruct";
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

function parseOllamaText(json: Record<string, unknown>) {
  const message = json.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content !== "string") {
    throw new Error("OLLAMA_INVALID_CONTENT");
  }

  return content;
}

export class OllamaChatAdapter {
  private readonly baseUrl: string;

  private readonly model: string;

  private readonly maxRetries: number;

  private readonly timeoutMs: number;

  constructor(config: OllamaChatAdapterConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
    this.model = config.model ?? process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generate(request: OllamaChatRequest): Promise<AgentRuntimeOutput> {
    const payload = {
      model: this.model,
      stream: false,
      options: {
        temperature: 0,
        top_p: 1,
        repeat_penalty: 1,
        seed: 0
      },
      messages: request.messages
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxRetries) {
      attempt += 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
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
          throw new Error(`OLLAMA_CHAT_FAILED:${response.status}:${errorBody}`);
        }

        const json = (await response.json()) as Record<string, unknown>;
        const content = parseOllamaText(json);
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
      : new Error("OLLAMA_CHAT_RETRIES_EXHAUSTED");
  }
}
