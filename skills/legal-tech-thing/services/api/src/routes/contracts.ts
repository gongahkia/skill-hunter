import type { FastifyPluginAsync } from "fastify";

const contractRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ module: "contracts", status: "ready" }));
};

export default contractRoutes;
