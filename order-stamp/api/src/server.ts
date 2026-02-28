import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { detectAdversarialClauses, getDetectorRules } from "./detector.js";

const detectBodySchema = z.object({
  text: z.string().min(1),
  maxFindings: z.number().int().positive().max(100).default(25),
  url: z.string().url().optional()
});

const detectHtmlBodySchema = z.object({
  html: z.string().min(1),
  maxFindings: z.number().int().positive().max(100).default(25),
  url: z.string().url().optional()
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", tool: "order-stamp" }));

app.get("/rules", async () => ({ items: getDetectorRules() }));

app.post("/detect", async (request, reply) => {
  const parsed = detectBodySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const report = detectAdversarialClauses(parsed.data.text, parsed.data.maxFindings);
  return {
    source: {
      kind: "text",
      url: parsed.data.url ?? null,
      characters: parsed.data.text.length
    },
    report
  };
});

app.post("/detect/html", async (request, reply) => {
  const parsed = detectHtmlBodySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const strippedText = parsed.data.html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const report = detectAdversarialClauses(strippedText, parsed.data.maxFindings);
  return {
    source: {
      kind: "html",
      url: parsed.data.url ?? null,
      characters: strippedText.length
    },
    report
  };
});

const port = Number(process.env.PORT ?? 4012);
await app.listen({ port, host: "0.0.0.0" });
