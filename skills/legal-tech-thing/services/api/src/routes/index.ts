import type { FastifyPluginAsync } from "fastify";

import authRoutes from "./auth";
import contractRoutes from "./contracts";
import findingRoutes from "./findings";
import healthRoutes from "./health";
import internalJobRoutes from "./internal-jobs";
import policyRoutes from "./policy";
import reviewRoutes from "./reviews";

const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes, { prefix: "/" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(contractRoutes, { prefix: "/contracts" });
  await app.register(reviewRoutes, { prefix: "/reviews" });
  await app.register(findingRoutes, { prefix: "/findings" });
  await app.register(policyRoutes, { prefix: "/policy" });
  await app.register(internalJobRoutes, { prefix: "/internal/jobs" });
};

export default registerRoutes;
