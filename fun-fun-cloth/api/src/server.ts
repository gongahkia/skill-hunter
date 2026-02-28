import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { compilePolicyDsl } from "./dsl-parser.js";
import { simulatePolicy } from "./simulator.js";
import { sampleContractText, samplePolicyDsl } from "./templates.js";
import type { CompiledPolicy } from "./types.js";

const compileBodySchema = z.object({
  dsl: z.string().min(1)
});

const simulateBodySchema = z.object({
  dsl: z.string().min(1),
  contractText: z.string().min(1)
});

const simulateCompiledBodySchema = z.object({
  compiledPolicy: z.custom<CompiledPolicy>(),
  contractText: z.string().min(1)
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", tool: "fun-fun-cloth" }));

app.get("/templates", async () => ({
  policyDsl: samplePolicyDsl,
  contractText: sampleContractText
}));

app.post("/compile", async (request, reply) => {
  const parsed = compileBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  try {
    const compiledPolicy = compilePolicyDsl(parsed.data.dsl);
    return { compiledPolicy };
  } catch (error) {
    return reply.status(400).send({ error: "DSL_COMPILE_ERROR", message: String(error) });
  }
});

app.post("/simulate", async (request, reply) => {
  const parsed = simulateBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  try {
    const compiledPolicy = compilePolicyDsl(parsed.data.dsl);
    const simulation = simulatePolicy(compiledPolicy, parsed.data.contractText);

    return {
      compiledPolicy,
      simulation
    };
  } catch (error) {
    return reply.status(400).send({ error: "SIMULATION_ERROR", message: String(error) });
  }
});

app.post("/simulate/compiled", async (request, reply) => {
  const parsed = simulateCompiledBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  try {
    return {
      simulation: simulatePolicy(parsed.data.compiledPolicy, parsed.data.contractText)
    };
  } catch (error) {
    return reply.status(400).send({ error: "SIMULATION_ERROR", message: String(error) });
  }
});

const port = Number(process.env.PORT ?? 4014);
await app.listen({ port, host: "0.0.0.0" });
