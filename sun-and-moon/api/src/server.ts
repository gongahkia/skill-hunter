import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { buildChronology } from "./engine.js";
import { readStore, writeStore } from "./store.js";
import type { ChronologyCase, ChronologyEvent } from "./types.js";

const createCaseSchema = z.object({
  name: z.string().min(1),
  jurisdiction: z.string().min(1),
  owner: z.string().min(1)
});

const createEventSchema = z.object({
  eventType: z.enum(["fact", "evidence", "filing", "communication", "hearing"]),
  title: z.string().min(1),
  description: z.string().min(1),
  eventDate: z.string().datetime(),
  sourceRef: z.string().min(1),
  citation: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([])
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", tool: "sun-and-moon" }));

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
  const caseRecord: ChronologyCase = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    jurisdiction: parsed.data.jurisdiction,
    owner: parsed.data.owner,
    createdAt: now,
    updatedAt: now
  };

  const store = await readStore();
  store.cases.push(caseRecord);
  await writeStore(store);

  return reply.status(201).send({ case: caseRecord });
});

app.post("/cases/:caseId/events", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  const parsed = createEventSchema.safeParse(request.body);

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

  const event: ChronologyEvent = {
    id: crypto.randomUUID(),
    caseId: caseRecord.id,
    eventType: parsed.data.eventType,
    title: parsed.data.title,
    description: parsed.data.description,
    eventDate: parsed.data.eventDate,
    sourceRef: parsed.data.sourceRef,
    citation: parsed.data.citation ?? null,
    tags: parsed.data.tags,
    createdAt: new Date().toISOString()
  };

  store.events.push(event);
  caseRecord.updatedAt = new Date().toISOString();
  await writeStore(store);

  return reply.status(201).send({ event });
});

app.get("/cases/:caseId/events", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: params.error.flatten() });
  }

  const store = await readStore();
  const items = store.events.filter((event) => event.caseId === params.data.caseId);

  return { items };
});

app.get("/cases/:caseId/chronology", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  const query = z
    .object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() })
    .safeParse(request.query);

  if (!params.success || !query.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      details: {
        params: params.success ? null : params.error.flatten(),
        query: query.success ? null : query.error.flatten()
      }
    });
  }

  const store = await readStore();
  const caseRecord = store.cases.find((item) => item.id === params.data.caseId);
  if (!caseRecord) {
    return reply.status(404).send({ error: "CASE_NOT_FOUND" });
  }

  const filtered = store.events.filter((event) => {
    if (event.caseId !== caseRecord.id) {
      return false;
    }

    if (query.data.from && event.eventDate < query.data.from) {
      return false;
    }

    if (query.data.to && event.eventDate > query.data.to) {
      return false;
    }

    return true;
  });

  return {
    case: caseRecord,
    chronology: buildChronology(filtered)
  };
});

app.post("/cases/:caseId/chronology/rebuild", async (request, reply) => {
  const params = z.object({ caseId: z.string().uuid() }).safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: params.error.flatten() });
  }

  const store = await readStore();
  const caseRecord = store.cases.find((item) => item.id === params.data.caseId);
  if (!caseRecord) {
    return reply.status(404).send({ error: "CASE_NOT_FOUND" });
  }

  const events = store.events.filter((event) => event.caseId === caseRecord.id);
  return {
    case: caseRecord,
    chronology: buildChronology(events)
  };
});

const port = Number(process.env.PORT ?? 4013);
await app.listen({ port, host: "0.0.0.0" });
