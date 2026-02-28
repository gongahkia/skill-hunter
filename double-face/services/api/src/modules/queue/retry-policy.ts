import type { JobsOptions } from "bullmq";

type QueueRetryPolicy = {
  attempts: number;
  backoffDelayMs: number;
  removeOnComplete: number;
  removeOnFail: number;
};

export const queueRetryPolicy = {
  "contract-ingestion": {
    attempts: 6,
    backoffDelayMs: 1_000,
    removeOnComplete: 1_000,
    removeOnFail: 5_000
  },
  "clause-embeddings": {
    attempts: 5,
    backoffDelayMs: 2_000,
    removeOnComplete: 500,
    removeOnFail: 2_000
  },
  "review-runs": {
    attempts: 4,
    backoffDelayMs: 1_500,
    removeOnComplete: 1_000,
    removeOnFail: 5_000
  }
} as const satisfies Record<string, QueueRetryPolicy>;

export function toDefaultJobOptions(policy: QueueRetryPolicy): JobsOptions {
  return {
    attempts: policy.attempts,
    backoff: {
      type: "exponential",
      delay: policy.backoffDelayMs
    },
    removeOnComplete: policy.removeOnComplete,
    removeOnFail: policy.removeOnFail
  };
}
