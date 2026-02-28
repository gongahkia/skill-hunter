import {
  agentRuntimeOutputSchema,
  type AgentRuntimeOutput
} from "../runtime";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GeminiGenerateAdapterConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  temperature?: number;
};

export type GeminiGenerateRequest = {
  messages: ChatMessage[];
};

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.0-flash";
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

function parseGeminiText(json: Record<string, unknown>) {
  const candidates = json.candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const textPart = parts?.find((part) => typeof part.text === "string");

  if (!textPart || typeof textPart.text !== "string") {
    throw new Error("GEMINI_INVALID_CONTENT");
  }

  return textPart.text;
}

export class GeminiGenerateAdapter {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly model: string;

  private readonly maxRetries: number;

  private readonly timeoutMs: number;

  private readonly temperature: number;

  constructor(config: GeminiGenerateAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl ?? process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL;
    this.model = config.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.temperature = config.temperature ?? 0;
  }

  async generate(request: GeminiGenerateRequest): Promise<AgentRuntimeOutput> {
    const systemPrompt = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const conversationalText = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: conversationalText }]
        }
      ],
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: this.temperature,
        responseMimeType: "application/json"
      }
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxRetries) {
      attempt += 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(
          `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);

        if (!response.ok) {
          if (shouldRetry(response.status) && attempt < this.maxRetries) {
            await sleep(2 ** attempt * 250);
            continue;
          }

          const errorBody = await response.text();
          throw new Error(`GEMINI_GENERATE_FAILED:${response.status}:${errorBody}`);
        }

        const json = (await response.json()) as Record<string, unknown>;
        const content = parseGeminiText(json);
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
      : new Error("GEMINI_GENERATE_RETRIES_EXHAUSTED");
  }
}
