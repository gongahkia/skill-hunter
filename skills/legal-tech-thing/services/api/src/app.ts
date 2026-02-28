import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";

import authGuardPlugin from "./plugins/auth-guard";
import prismaPlugin from "./plugins/prisma";
import queuesPlugin from "./plugins/queues";
import redisPlugin from "./plugins/redis";
import storagePlugin from "./plugins/storage";
import registerRoutes from "./routes";

export function buildApp() {
  const requestIdHeader = "x-request-id";
  const app = Fastify({
    requestIdHeader,
    genReqId: (request) => {
      const incomingRequestId = request.headers[requestIdHeader] ?? request.headers[requestIdHeader.toUpperCase()];
      if (typeof incomingRequestId === "string" && incomingRequestId.trim().length > 0) {
        return incomingRequestId.trim();
      }

      return randomUUID();
    },
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header(requestIdHeader, request.id);
    done();
  });

  app.register(helmet);
  app.register(cors, {
    origin: true,
    credentials: true
  });
  app.register(prismaPlugin);
  app.register(redisPlugin);
  app.register(queuesPlugin);
  app.register(storagePlugin);
  app.register(authGuardPlugin);
  app.register(registerRoutes);

  return app;
}
