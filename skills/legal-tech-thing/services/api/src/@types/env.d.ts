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
    }
  }
}
