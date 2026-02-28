import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import fp from "fastify-plugin";

export type ObjectStorage = {
  bucket: string;
  putObject: (params: Omit<PutObjectCommandInput, "Bucket">) => Promise<string>;
  getObject: (key: string) => Promise<GetObjectCommandOutput>;
  deleteObject: (key: string) => Promise<void>;
};

declare module "fastify" {
  interface FastifyInstance {
    objectStorage: ObjectStorage;
  }
}

function isPathStyleEnabled(): boolean {
  return (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() === "true";
}

const storagePlugin = fp(async (app) => {
  const bucket = process.env.S3_BUCKET ?? "legal-tech-artifacts";

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: isPathStyleEnabled(),
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined
  });

  app.decorate("objectStorage", {
    bucket,
    async putObject(params) {
      await client.send(
        new PutObjectCommand({
          ...params,
          Bucket: bucket
        })
      );

      return `${bucket}/${params.Key}`;
    },
    async getObject(key) {
      return client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );
    },
    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );
    }
  } satisfies ObjectStorage);
});

export default storagePlugin;
