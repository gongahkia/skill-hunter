import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { generateBundle, loadBundleArtifact, verifyArtifact } from "./bundle-service.js";
import { readStore, writeStore } from "./store.js";
import type { CaseRecord, EvidenceRecord, FindingRecord, Severity } from "./types.js";

const createCaseSchema = z.object({
  name: z.string().min(1),
  matterNumber: z.string().min(1),
  owner: z.string().min(1)
});

const createEvidenceSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["document", "email", "chat", "note", "external"]),
  sourceRef: z.string().min(1),
  capturedAt: z.string().datetime(),
  excerpt: z.string().min(1),
  chainOfCustody: z.array(z.string().min(1)).default([])
});

const createFindingSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  evidenceIds: z.array(z.string().uuid()).default([]),
  status: z.enum(["open", "accepted", "dismissed"]).default("open")
});

const generateBundleSchema = z.object({
  requestedBy: z.string().min(1),
  includeDismissed: z.boolean().default(false)
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", tool: "conver-hands" }));

app.get("/cases", async () => {
  const store = await readStore();
  return { items: store.cases };
});

app.post("/cases", async (request, reply) => {
  const parsed = createCaseSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  const nextCase: CaseRecord = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    matterNumber: parsed.data.matterNumber,
    owner: parsed.data.owner,
    createdAt: now,
    updatedAt: now
  };

  const store = await readStore();
  store.cases.push(nextCase);
  await writeStore(store);

  return reply.status(201).send({ case: nextCase });
});

app.post("/cases/:caseId/evidence", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  const parsed = createEvidenceSchema.safeParse(request.body);

  if (!params.success || !parsed.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      details: {
        params: params.success ? null : params.error.flatten(),
        body: parsed.success ? null : parsed.error.flatten()
      }
    });
  }

  const store = await readStore();
  const caseRecord = store.cases.find((item) => item.id === params.data.caseId);
  if (!caseRecord) {
    return reply.status(404).send({ error: "CASE_NOT_FOUND" });
  }

  const evidence: EvidenceRecord = {
    id: crypto.randomUUID(),
    caseId: caseRecord.id,
    title: parsed.data.title,
    sourceType: parsed.data.sourceType,
    sourceRef: parsed.data.sourceRef,
    capturedAt: parsed.data.capturedAt,
    excerpt: parsed.data.excerpt,
    chainOfCustody: parsed.data.chainOfCustody,
    createdAt: new Date().toISOString()
  };

  store.evidence.push(evidence);
  caseRecord.updatedAt = new Date().toISOString();
  await writeStore(store);

  return reply.status(201).send({ evidence });
});

app.post("/cases/:caseId/findings", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  const parsed = createFindingSchema.safeParse(request.body);

  if (!params.success || !parsed.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      details: {
        params: params.success ? null : params.error.flatten(),
        body: parsed.success ? null : parsed.error.flatten()
      }
    });
  }

  const store = await readStore();
  const caseRecord = store.cases.find((item) => item.id === params.data.caseId);
  if (!caseRecord) {
    return reply.status(404).send({ error: "CASE_NOT_FOUND" });
  }

  const knownEvidenceIds = new Set(
    store.evidence.filter((item) => item.caseId === caseRecord.id).map((item) => item.id)
  );

  const unknownEvidenceId = parsed.data.evidenceIds.find((id) => !knownEvidenceIds.has(id));
  if (unknownEvidenceId) {
    return reply.status(400).send({ error: "UNKNOWN_EVIDENCE_ID", evidenceId: unknownEvidenceId });
  }

  const now = new Date().toISOString();
  const finding: FindingRecord = {
    id: crypto.randomUUID(),
    caseId: caseRecord.id,
    title: parsed.data.title,
    summary: parsed.data.summary,
    severity: parsed.data.severity as Severity,
    evidenceIds: parsed.data.evidenceIds,
    status: parsed.data.status,
    createdAt: now,
    updatedAt: now
  };

  store.findings.push(finding);
  caseRecord.updatedAt = now;
  await writeStore(store);

  return reply.status(201).send({ finding });
});

app.post("/cases/:caseId/bundles/generate", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  const parsed = generateBundleSchema.safeParse(request.body);

  if (!params.success || !parsed.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      details: {
        params: params.success ? null : params.error.flatten(),
        body: parsed.success ? null : parsed.error.flatten()
      }
    });
  }

  const store = await readStore();
  const caseRecord = store.cases.find((item) => item.id === params.data.caseId);
  if (!caseRecord) {
    return reply.status(404).send({ error: "CASE_NOT_FOUND" });
  }

  const evidence = store.evidence.filter((item) => item.caseId === caseRecord.id);
  const findings = store.findings.filter(
    (item) => item.caseId === caseRecord.id && (parsed.data.includeDismissed || item.status !== "dismissed")
  );

  const result = await generateBundle({
    caseRecord,
    evidence,
    findings,
    requestedBy: parsed.data.requestedBy
  });

  return reply.status(201).send(result);
});

app.get("/cases/:caseId/bundles", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: params.error.flatten() });
  }

  const store = await readStore();
  const items = store.bundles.filter((item) => item.caseId === params.data.caseId);
  return { items };
});

app.get("/bundles/:bundleId", async (request, reply) => {
  const params = z.object({ bundleId: z.string().uuid() }).safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: params.error.flatten() });
  }

  const store = await readStore();
  const bundle = store.bundles.find((item) => item.id === params.data.bundleId);
  if (!bundle) {
    return reply.status(404).send({ error: "BUNDLE_NOT_FOUND" });
  }

  const artifact = await loadBundleArtifact(bundle.filePath);
  return { bundle, artifact };
});

app.post("/bundles/:bundleId/verify", async (request, reply) => {
  const params = z.object({ bundleId: z.string().uuid() }).safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: params.error.flatten() });
  }

  const store = await readStore();
  const bundle = store.bundles.find((item) => item.id === params.data.bundleId);
  if (!bundle) {
    return reply.status(404).send({ error: "BUNDLE_NOT_FOUND" });
  }

  const artifact = await loadBundleArtifact(bundle.filePath);
  const verification = verifyArtifact(artifact);

  return {
    bundleId: bundle.id,
    valid: verification.validDigest && verification.validSignature && verification.validTimelineHash,
    verification
  };
});

const port = Number(process.env.PORT ?? 4011);
await app.listen({ port, host: "0.0.0.0" });
