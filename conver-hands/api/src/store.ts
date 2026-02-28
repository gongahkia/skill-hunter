import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Store } from "./types.js";

const dataDir = path.resolve(process.cwd(), "data");
const storeFilePath = path.join(dataDir, "store.json");

const defaultStore: Store = {
  cases: [],
  evidence: [],
  findings: [],
  bundles: []
};

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(storeFilePath, "utf8");
  } catch {
    await writeFile(storeFilePath, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<Store> {
  await ensureStoreFile();
  const raw = await readFile(storeFilePath, "utf8");
  const parsed = JSON.parse(raw) as Store;

  return {
    cases: parsed.cases ?? [],
    evidence: parsed.evidence ?? [],
    findings: parsed.findings ?? [],
    bundles: parsed.bundles ?? []
  };
}

export async function writeStore(next: Store): Promise<void> {
  await ensureStoreFile();
  await writeFile(storeFilePath, JSON.stringify(next, null, 2), "utf8");
}

export { storeFilePath };
