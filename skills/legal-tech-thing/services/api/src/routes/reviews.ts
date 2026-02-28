import type { FastifyPluginAsync } from "fastify";

const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ module: "reviews", status: "ready" }));
};

export default reviewRoutes;
