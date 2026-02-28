import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ChronologyStore } from "./types.js";

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

const initialStore: ChronologyStore = {
  cases: [],
  events: []
};

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(initialStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<ChronologyStore> {
  await ensureStore();
  const parsed = JSON.parse(await readFile(storePath, "utf8")) as ChronologyStore;
  return {
    cases: parsed.cases ?? [],
    events: parsed.events ?? []
  };
}

export async function writeStore(next: ChronologyStore) {
  await ensureStore();
  await writeFile(storePath, JSON.stringify(next, null, 2), "utf8");
}
