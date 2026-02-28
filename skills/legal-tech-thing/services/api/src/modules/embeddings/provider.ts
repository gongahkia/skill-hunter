import { createHash } from "node:crypto";

import type { EmbeddingProvider } from "./types";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
const MOCK_EMBEDDING_DIMENSION = 256;

function normalizeVector(raw: number[]) {
  const magnitude = Math.sqrt(raw.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return raw;
  }

  return raw.map((value) => value / magnitude);
}

function createMockEmbedding(text: string) {
  const hash = createHash("sha256").update(text).digest();
  const vector = Array.from({ length: MOCK_EMBEDDING_DIMENSION }, (_, index) => {
    const value = hash[index % hash.length] ?? 0;
    return value / 255;
  });

  return normalizeVector(vector);
}

function buildMockProvider(): EmbeddingProvider {
  return {
    name: "mock",
    async embedTexts(texts) {
      return texts.map((text) => createMockEmbedding(text));
    }
  };
}

function buildOpenAiProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL;
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_OPENAI_EMBEDDING_MODEL;

  return {
    name: "openai",
    async embedTexts(texts) {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: texts
        })
      });

      if (!response.ok) {
        throw new Error(`OPENAI_EMBEDDINGS_FAILED:${response.status}`);
      }

      const json = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };

      return json.data.map((item) => item.embedding);
    }
  };
}

function buildOllamaProvider(): EmbeddingProvider {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_OLLAMA_EMBEDDING_MODEL;

  return {
    name: "ollama",
    async embedTexts(texts) {
      const vectors: number[][] = [];

      for (const text of texts) {
        const response = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            prompt: text
          })
        });

        if (!response.ok) {
          throw new Error(`OLLAMA_EMBEDDINGS_FAILED:${response.status}`);
        }

        const json = (await response.json()) as { embedding: number[] };
        vectors.push(json.embedding);
      }

      return vectors;
    }
  };
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "mock").toLowerCase();

  if (provider === "openai") {
    return buildOpenAiProvider();
  }

  if (provider === "ollama") {
    return buildOllamaProvider();
  }

  return buildMockProvider();
}
