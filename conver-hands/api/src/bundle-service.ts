import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chainHashes, sha256, signDigest, stableStringify } from "./crypto.js";
import { readStore, writeStore } from "./store.js";
import type {
  BundleRecord,
  CaseRecord,
  EvidenceRecord,
  ExportArtifact,
  FindingRecord
} from "./types.js";

const bundleDir = path.resolve(process.cwd(), "data", "bundles");

function getSigningSecret() {
  return process.env.CONVER_HANDS_SIGNING_SECRET ?? "conver-hands-dev-secret";
}

function hashById<T extends { id: string }>(items: T[]) {
  return items.map((item) => ({
    id: item.id,
    hash: sha256(stableStringify(item))
  }));
}

export async function generateBundle(input: {
  caseRecord: CaseRecord;
  evidence: EvidenceRecord[];
  findings: FindingRecord[];
  requestedBy: string;
}) {
  const evidenceHashes = hashById(input.evidence);
  const findingHashes = hashById(input.findings);

  const timelineHash = chainHashes([
    ...evidenceHashes.map((item) => item.hash),
    ...findingHashes.map((item) => item.hash)
  ]);

  const digest = sha256(
    stableStringify({
      caseId: input.caseRecord.id,
      generatedAt: new Date().toISOString(),
      timelineHash,
      evidenceHashes,
      findingHashes
    })
  );
  const signature = signDigest(digest, getSigningSecret());

  const artifact: ExportArtifact = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    case: input.caseRecord,
    evidence: input.evidence,
    findings: input.findings,
    manifest: {
      evidenceHashes,
      findingHashes,
      timelineHash,
      digest,
      signature
    }
  };

  const bundleId = crypto.randomUUID();
  await mkdir(bundleDir, { recursive: true });
  const filePath = path.join(bundleDir, `${bundleId}.json`);
  await writeFile(filePath, JSON.stringify(artifact, null, 2), "utf8");

  const record: BundleRecord = {
    id: bundleId,
    caseId: input.caseRecord.id,
    generatedAt: artifact.generatedAt,
    requestedBy: input.requestedBy,
    digest,
    signature,
    filePath,
    findingsCount: input.findings.length,
    evidenceCount: input.evidence.length
  };

  const store = await readStore();
  store.bundles.push(record);
  await writeStore(store);

  return {
    bundle: record,
    artifact
  };
}

export async function loadBundleArtifact(filePath: string): Promise<ExportArtifact> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as ExportArtifact;
}

export function verifyArtifact(artifact: ExportArtifact) {
  const recomputedEvidenceHashes = hashById(artifact.evidence);
  const recomputedFindingHashes = hashById(artifact.findings);

  const recomputedTimeline = chainHashes([
    ...recomputedEvidenceHashes.map((item) => item.hash),
    ...recomputedFindingHashes.map((item) => item.hash)
  ]);

  const recomputedDigest = sha256(
    stableStringify({
      caseId: artifact.case.id,
      generatedAt: artifact.generatedAt,
      timelineHash: recomputedTimeline,
      evidenceHashes: recomputedEvidenceHashes,
      findingHashes: recomputedFindingHashes
    })
  );

  const recomputedSignature = signDigest(recomputedDigest, getSigningSecret());

  return {
    validDigest: recomputedDigest === artifact.manifest.digest,
    validSignature: recomputedSignature === artifact.manifest.signature,
    validTimelineHash: recomputedTimeline === artifact.manifest.timelineHash,
    recomputedDigest,
    recomputedSignature,
    recomputedTimelineHash: recomputedTimeline
  };
}
