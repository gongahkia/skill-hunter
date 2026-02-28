export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      REDIS_URL?: string;
      S3_ENDPOINT?: string;
      S3_REGION?: string;
      S3_ACCESS_KEY_ID?: string;
      S3_SECRET_ACCESS_KEY?: string;
      S3_BUCKET?: string;
      S3_FORCE_PATH_STYLE?: string;
    }
  }
}
