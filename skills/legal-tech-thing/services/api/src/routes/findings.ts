import type { FastifyPluginAsync } from "fastify";

const findingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ module: "findings", status: "ready" }));
};

export default findingRoutes;
