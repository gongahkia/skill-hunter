import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type QueueJob = {
  id: string;
  caseId: string;
  requestedBy: string;
  status: "pending" | "completed" | "failed";
  response?: unknown;
  error?: string;
};

type QueueState = {
  jobs: QueueJob[];
};

const queueFilePath = path.resolve(process.cwd(), "data", "queue.json");
const apiBaseUrl = (process.env.CONVER_HANDS_API_URL ?? "http://127.0.0.1:4011").replace(/\/$/, "");

async function ensureQueueFile() {
  await mkdir(path.dirname(queueFilePath), { recursive: true });

  try {
    await readFile(queueFilePath, "utf8");
  } catch {
    const initial: QueueState = { jobs: [] };
    await writeFile(queueFilePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readQueue() {
  await ensureQueueFile();
  return JSON.parse(await readFile(queueFilePath, "utf8")) as QueueState;
}

async function writeQueue(state: QueueState) {
  await writeFile(queueFilePath, JSON.stringify(state, null, 2), "utf8");
}

async function processPendingJobs() {
  const state = await readQueue();
  let processed = 0;

  for (const job of state.jobs) {
    if (job.status !== "pending") {
      continue;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/cases/${job.caseId}/bundles/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ requestedBy: job.requestedBy, includeDismissed: false })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }

      job.status = "completed";
      job.response = payload;
      processed += 1;
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      processed += 1;
    }
  }

  await writeQueue(state);
  console.log(`[conver-hands/worker-export] processed ${processed} job(s)`);
}

await processPendingJobs();
