import { createHash, createHmac } from "node:crypto";

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }

    return val;
  });
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function chainHashes(hashes: string[]): string {
  if (hashes.length === 0) {
    return sha256("empty");
  }

  let cursor = sha256("seed");
  for (const hash of hashes) {
    cursor = sha256(`${cursor}:${hash}`);
  }

  return cursor;
}

export function signDigest(digest: string, secret: string): string {
  return createHmac("sha256", secret).update(digest).digest("hex");
}
