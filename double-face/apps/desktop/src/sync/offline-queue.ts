const OFFLINE_QUEUE_STORAGE_KEY = "legaltech.desktop.pendingScans.v1";

export type PendingScanKind = "ocr" | "clipboard";

export interface PendingScanItem {
  id: string;
  kind: PendingScanKind;
  title: string;
  content: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

type PendingScanInput = {
  kind: PendingScanKind;
  title: string;
  content: string;
};

function createQueueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `pending-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sanitizeQueueItem(rawItem: unknown): PendingScanItem | null {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const candidate = rawItem as Record<string, unknown>;
  const kind = candidate.kind === "ocr" || candidate.kind === "clipboard" ? candidate.kind : null;
  const id = typeof candidate.id === "string" ? candidate.id : null;
  const title = typeof candidate.title === "string" ? candidate.title : null;
  const content = typeof candidate.content === "string" ? candidate.content : null;

  if (!kind || !id || !title || !content) {
    return null;
  }

  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString();
  const attempts =
    typeof candidate.attempts === "number" && Number.isFinite(candidate.attempts)
      ? Math.max(0, Math.floor(candidate.attempts))
      : 0;
  const lastError = typeof candidate.lastError === "string" ? candidate.lastError : null;

  return {
    id,
    kind,
    title,
    content,
    createdAt,
    attempts,
    lastError
  };
}

function readStorage() {
  try {
    const rawQueue = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!rawQueue) {
      return [] as PendingScanItem[];
    }

    const parsed = JSON.parse(rawQueue) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as PendingScanItem[];
    }

    return parsed
      .map((item) => sanitizeQueueItem(item))
      .filter((item): item is PendingScanItem => item !== null);
  } catch (_error) {
    return [] as PendingScanItem[];
  }
}

function writeStorage(queue: PendingScanItem[]) {
  window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export function loadPendingScanQueue() {
  return readStorage();
}

export function enqueuePendingScan(input: PendingScanInput) {
  const nextItem: PendingScanItem = {
    id: createQueueId(),
    kind: input.kind,
    title: input.title,
    content: input.content,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null
  };

  const queue = readStorage();
  const nextQueue = [...queue, nextItem];
  writeStorage(nextQueue);
  return nextQueue;
}

export function removePendingScanById(scanId: string) {
  const queue = readStorage();
  const nextQueue = queue.filter((item) => item.id !== scanId);
  writeStorage(nextQueue);
  return nextQueue;
}

export function updatePendingScanAttempt(scanId: string, error: string) {
  const queue = readStorage();
  const nextQueue = queue.map((item) =>
    item.id === scanId
      ? {
          ...item,
          attempts: item.attempts + 1,
          lastError: error
        }
      : item
  );

  writeStorage(nextQueue);
  return nextQueue;
}
