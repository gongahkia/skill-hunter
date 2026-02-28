import type { FastifyPluginAsync } from "fastify";

const policyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ module: "policy", status: "ready" }));
};

export default policyRoutes;
