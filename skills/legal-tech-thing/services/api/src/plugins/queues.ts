import { Queue } from "bullmq";
import fp from "fastify-plugin";

import {
  CLAUSE_EMBEDDINGS_QUEUE,
  type ClauseEmbeddingJobPayload
} from "../modules/embeddings/types";
import {
  CONTRACT_INGESTION_QUEUE,
  type ContractIngestionJobPayload
} from "../modules/ingest/types";
import { REVIEW_RUN_QUEUE, type ReviewRunJobPayload } from "../modules/reviews/types";
import { queueRetryPolicy, toDefaultJobOptions } from "../modules/queue/retry-policy";

type AppQueues = {
  contractIngestionQueue: Queue;
  clauseEmbeddingsQueue: Queue;
  reviewRunQueue: Queue;
};

declare module "fastify" {
  interface FastifyInstance {
    queues: AppQueues;
  }
}

function getQueuePrefix() {
  return process.env.REDIS_QUEUE_PREFIX ?? "legal-tech";
}

function buildQueueConnection() {
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  const dbPath = redisUrl.pathname.replace("/", "");

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: dbPath ? Number(dbPath) : 0,
    tls: redisUrl.protocol === "rediss:" ? {} : undefined
  };
}

const queuesPlugin = fp(async (app) => {
  const contractIngestionQueue = new Queue<ContractIngestionJobPayload>(
    CONTRACT_INGESTION_QUEUE,
    {
      connection: buildQueueConnection(),
      prefix: getQueuePrefix(),
      defaultJobOptions: toDefaultJobOptions(queueRetryPolicy[CONTRACT_INGESTION_QUEUE])
    }
  );
  const clauseEmbeddingsQueue = new Queue<ClauseEmbeddingJobPayload>(
    CLAUSE_EMBEDDINGS_QUEUE,
    {
      connection: buildQueueConnection(),
      prefix: getQueuePrefix(),
      defaultJobOptions: toDefaultJobOptions(queueRetryPolicy[CLAUSE_EMBEDDINGS_QUEUE])
    }
  );
  const reviewRunQueue = new Queue<ReviewRunJobPayload>(REVIEW_RUN_QUEUE, {
    connection: buildQueueConnection(),
    prefix: getQueuePrefix(),
    defaultJobOptions: toDefaultJobOptions(queueRetryPolicy[REVIEW_RUN_QUEUE])
  });

  app.decorate("queues", {
    contractIngestionQueue,
    clauseEmbeddingsQueue,
    reviewRunQueue
  });

  app.addHook("onClose", async () => {
    await app.queues.contractIngestionQueue.close();
    await app.queues.clauseEmbeddingsQueue.close();
    await app.queues.reviewRunQueue.close();
  });
});

export default queuesPlugin;
