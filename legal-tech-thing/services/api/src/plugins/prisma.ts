import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

const prisma = new PrismaClient();

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await app.prisma.$disconnect();
  });
});

export default prismaPlugin;
