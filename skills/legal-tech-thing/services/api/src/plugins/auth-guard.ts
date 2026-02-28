import fp from "fastify-plugin";

import { verifyAccessToken } from "../modules/auth/jwt";

const PUBLIC_PATHS = new Set([
  "/health",
  "/auth/register",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout"
]);

const authGuardPlugin = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    if (PUBLIC_PATHS.has(request.url)) {
      return;
    }

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "UNAUTHORIZED"
      });
    }

    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    try {
      const payload = await verifyAccessToken(token);
      const session = await app.prisma.session.findUnique({
        where: {
          id: payload.sessionId
        },
        select: {
          id: true,
          userId: true,
          revokedAt: true,
          expiresAt: true
        }
      });

      if (!session || session.userId !== payload.userId || session.revokedAt) {
        return reply.status(401).send({
          error: "UNAUTHORIZED"
        });
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        return reply.status(401).send({
          error: "UNAUTHORIZED"
        });
      }

      request.auth = {
        userId: payload.userId,
        sessionId: payload.sessionId
      };
    } catch {
      return reply.status(401).send({
        error: "UNAUTHORIZED"
      });
    }
  });
});

export default authGuardPlugin;
