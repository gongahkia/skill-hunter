import { Worker, type Job } from "bullmq";

import {
  CONTRACT_INGESTION_QUEUE,
  type ContractIngestionJobPayload
} from "../modules/ingest/types";
import { closeDeadLetterQueues, enqueueDeadLetterJob } from "../modules/queue/dead-letter";
import {
  closeIngestionWorkerResources,
  failContractIngestionJob,
  processContractIngestionJob
} from "../modules/ingest/worker";
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

const worker = new Worker<ContractIngestionJobPayload>(
  CONTRACT_INGESTION_QUEUE,
  async (job: Job<ContractIngestionJobPayload>) => {
    try {
      await processContractIngestionJob(job.data);
    } catch (error) {
      await failContractIngestionJob(job.data.contractId);
      throw error;
    }
  },
  {
    connection: buildQueueConnection(),
    prefix: getQueuePrefix(),
    concurrency: Number(process.env.INGESTION_WORKER_CONCURRENCY ?? 5)
  }
);

worker.on("ready", () => {
  console.log("Ingestion worker ready");
});

worker.on("failed", (job, error) => {
  console.error(
    "Ingestion job failed",
    scrubPii({
      jobId: job?.id,
      requestId: job?.data?.requestId,
      contractId: job?.data?.contractId,
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

  void enqueueDeadLetterJob(CONTRACT_INGESTION_QUEUE, {
    sourceQueue: CONTRACT_INGESTION_QUEUE,
    sourceJobId: String(job.id ?? `unknown-${Date.now()}`),
    requestId: job.data.requestId,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
    errorMessage: error instanceof Error ? error.message : "UNKNOWN_INGESTION_ERROR",
    payload: job.data
  });
});

async function shutdown() {
  await worker.close();
  await closeIngestionWorkerResources();
  await closeDeadLetterQueues();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
