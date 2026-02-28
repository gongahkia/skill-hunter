import { Worker, type Job } from "bullmq";

import {
  generateClauseEmbeddings,
  closeEmbeddingsGeneratorResources
} from "../modules/embeddings/generate";
import {
  CLAUSE_EMBEDDINGS_QUEUE,
  type ClauseEmbeddingJobPayload
} from "../modules/embeddings/types";
import { closeDeadLetterQueues, enqueueDeadLetterJob } from "../modules/queue/dead-letter";
import { scrubPii } from "../modules/security/pii-scrubber";

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

const worker = new Worker<ClauseEmbeddingJobPayload>(
  CLAUSE_EMBEDDINGS_QUEUE,
  async (job: Job<ClauseEmbeddingJobPayload>) => {
    const result = await generateClauseEmbeddings(job.data.contractVersionId);

    console.log(
      "Generated clause embeddings",
      scrubPii({
        requestId: job.data.requestId,
        contractVersionId: job.data.contractVersionId,
        provider: result.providerName,
        count: result.embeddings.length
      })
    );
  },
  {
    connection: buildQueueConnection(),
    prefix: getQueuePrefix(),
    concurrency: Number(process.env.EMBEDDINGS_WORKER_CONCURRENCY ?? 2)
  }
);

worker.on("ready", () => {
  console.log("Embeddings worker ready");
});

worker.on("failed", (job, error) => {
  console.error(
    "Embeddings job failed",
    scrubPii({
      jobId: job?.id,
      requestId: job?.data?.requestId,
      contractVersionId: job?.data?.contractVersionId,
      error
    })
  );

  if (!job) {
    return;
  }

  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
  if (job.attemptsMade < maxAttempts) {
    return;
  }

  void enqueueDeadLetterJob(CLAUSE_EMBEDDINGS_QUEUE, {
    sourceQueue: CLAUSE_EMBEDDINGS_QUEUE,
    sourceJobId: String(job.id ?? `unknown-${Date.now()}`),
    requestId: job.data.requestId,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
    errorMessage: error instanceof Error ? error.message : "UNKNOWN_EMBEDDINGS_ERROR",
    payload: job.data
  });
});

async function shutdown() {
  await worker.close();
  await closeEmbeddingsGeneratorResources();
  await closeDeadLetterQueues();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
