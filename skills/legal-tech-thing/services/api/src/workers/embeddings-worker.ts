import { Worker, type Job } from "bullmq";

import {
  generateClauseEmbeddings,
  closeEmbeddingsGeneratorResources
} from "../modules/embeddings/generate";
import {
  CLAUSE_EMBEDDINGS_QUEUE,
  type ClauseEmbeddingJobPayload
} from "../modules/embeddings/types";

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

    console.log("Generated clause embeddings", {
      contractVersionId: job.data.contractVersionId,
      provider: result.providerName,
      count: result.embeddings.length
    });
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
  console.error("Embeddings job failed", {
    jobId: job?.id,
    contractVersionId: job?.data?.contractVersionId,
    error
  });
});

async function shutdown() {
  await worker.close();
  await closeEmbeddingsGeneratorResources();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
