import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import registerRoutes from "./routes";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  app.register(helmet);
  app.register(cors, {
    origin: true,
    credentials: true
  });
  app.register(prismaPlugin);
  app.register(redisPlugin);
  app.register(registerRoutes);

  return app;
}
