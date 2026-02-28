import { Queue } from "bullmq";

export type DeadLetterJobPayload<TPayload = unknown> = {
  sourceQueue: string;
  sourceJobId: string;
  requestId: string | null;
  attemptsMade: number;
  failedAt: string;
  errorMessage: string;
  payload: TPayload;
};

const deadLetterQueuesByName = new Map<string, Queue<DeadLetterJobPayload>>();

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

function getDeadLetterQueueName(sourceQueue: string) {
  return `${sourceQueue}-dead-letter`;
}

function getDeadLetterQueue(sourceQueue: string) {
  const queueName = getDeadLetterQueueName(sourceQueue);
  const existingQueue = deadLetterQueuesByName.get(queueName);

  if (existingQueue) {
    return existingQueue;
  }

  const queue = new Queue<DeadLetterJobPayload>(queueName, {
    connection: buildQueueConnection(),
    prefix: getQueuePrefix(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 5_000,
      removeOnFail: 20_000
    }
  });

  deadLetterQueuesByName.set(queueName, queue);
  return queue;
}

export async function enqueueDeadLetterJob<TPayload>(
  sourceQueue: string,
  payload: DeadLetterJobPayload<TPayload>
) {
  const queue = getDeadLetterQueue(sourceQueue);
  const failedAtToken = payload.failedAt.replace(/[:.]/g, "-");

  return queue.add(`dead-letter:${payload.sourceJobId}:${failedAtToken}`, payload);
}

export async function closeDeadLetterQueues() {
  await Promise.all(
    Array.from(deadLetterQueuesByName.values()).map(async (queue) => {
      await queue.close();
    })
  );
  deadLetterQueuesByName.clear();
}
