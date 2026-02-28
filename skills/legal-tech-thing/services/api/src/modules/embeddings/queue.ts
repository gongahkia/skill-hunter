import { Queue } from "bullmq";

import {
  CLAUSE_EMBEDDINGS_QUEUE,
  type ClauseEmbeddingJobPayload
} from "./types";
import { queueRetryPolicy, toDefaultJobOptions } from "../queue/retry-policy";

let clauseEmbeddingsQueue: Queue<ClauseEmbeddingJobPayload> | null = null;

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

function getQueuePrefix() {
  return process.env.REDIS_QUEUE_PREFIX ?? "legal-tech";
}

function getClauseEmbeddingsQueue() {
  if (!clauseEmbeddingsQueue) {
    clauseEmbeddingsQueue = new Queue<ClauseEmbeddingJobPayload>(
      CLAUSE_EMBEDDINGS_QUEUE,
      {
        connection: buildQueueConnection(),
        prefix: getQueuePrefix(),
        defaultJobOptions: toDefaultJobOptions(queueRetryPolicy[CLAUSE_EMBEDDINGS_QUEUE])
      }
    );
  }

  return clauseEmbeddingsQueue;
}

export async function enqueueClauseEmbeddingJob(payload: ClauseEmbeddingJobPayload) {
  const queue = getClauseEmbeddingsQueue();

  return queue.add(`clause-embeddings:${payload.contractVersionId}:${payload.requestId}`, payload, {
    jobId: payload.contractVersionId
  });
}

export async function closeEmbeddingsQueue() {
  if (clauseEmbeddingsQueue) {
    await clauseEmbeddingsQueue.close();
    clauseEmbeddingsQueue = null;
  }
}
