import type { FastifyPluginAsync } from "fastify";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ module: "auth", status: "ready" }));
};

export default authRoutes;
