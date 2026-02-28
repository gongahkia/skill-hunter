export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      REDIS_URL?: string;
      REDIS_QUEUE_PREFIX?: string;
      S3_ENDPOINT?: string;
      S3_REGION?: string;
      S3_ACCESS_KEY_ID?: string;
      S3_SECRET_ACCESS_KEY?: string;
      S3_BUCKET?: string;
      S3_FORCE_PATH_STYLE?: string;
      S3_PRESIGNED_UPLOAD_TTL_SECONDS?: string;
      JWT_ACCESS_SECRET?: string;
      ACCESS_TOKEN_TTL?: string;
      REFRESH_TOKEN_TTL_DAYS?: string;
      EMBEDDING_PROVIDER?: string;
      OPENAI_API_KEY?: string;
      OPENAI_BASE_URL?: string;
      OPENAI_CHAT_MODEL?: string;
      OPENAI_EMBEDDING_MODEL?: string;
      ANTHROPIC_API_KEY?: string;
      ANTHROPIC_BASE_URL?: string;
      ANTHROPIC_MODEL?: string;
      GEMINI_API_KEY?: string;
      GEMINI_BASE_URL?: string;
      GEMINI_MODEL?: string;
      OLLAMA_BASE_URL?: string;
      OLLAMA_CHAT_MODEL?: string;
      OLLAMA_EMBEDDING_MODEL?: string;
      INTERNAL_WEBHOOK_SECRET?: string;
    }
  }
}
