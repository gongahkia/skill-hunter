import { compare, hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  buildRefreshTokenBundle,
  parseRefreshTokenSessionId,
  hashRefreshToken,
  signAccessToken
} from "../modules/auth/tokens";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12)
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});

const INVALID_CREDENTIALS_ERROR = {
  error: "INVALID_CREDENTIALS"
} as const;

const INVALID_REFRESH_ERROR = {
  error: "INVALID_REFRESH_TOKEN"
} as const;

const REUSE_DETECTED_ERROR = {
  error: "TOKEN_REUSE_DETECTED"
} as const;

async function revokeSessionFamily(app: Parameters<FastifyPluginAsync>[0], tokenFamilyId: string) {
  await app.prisma.session.updateMany({
    where: {
      tokenFamilyId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const parseResult = registerBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const email = parseResult.data.email.trim().toLowerCase();
    const passwordHash = await hash(parseResult.data.password, 12);

    try {
      const createdUser = await app.prisma.user.create({
        data: {
          email,
          passwordHash
        },
        select: {
          id: true,
          email: true,
          createdAt: true
        }
      });

      return reply.status(201).send({
        user: createdUser
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.status(409).send({
          error: "EMAIL_ALREADY_EXISTS"
        });
      }

      throw error;
    }
  });

  app.post("/login", async (request, reply) => {
    const parseResult = loginBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const email = parseResult.data.email.trim().toLowerCase();

    const user = await app.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return reply.status(401).send(INVALID_CREDENTIALS_ERROR);
    }

    const isPasswordValid = await compare(parseResult.data.password, user.passwordHash);

    if (!isPasswordValid) {
      return reply.status(401).send(INVALID_CREDENTIALS_ERROR);
    }

    const refreshTokenBundle = buildRefreshTokenBundle();

    await app.prisma.session.create({
      data: {
        id: refreshTokenBundle.sessionId,
        userId: user.id,
        tokenHash: refreshTokenBundle.refreshTokenHash,
        tokenFamilyId: refreshTokenBundle.tokenFamilyId,
        expiresAt: refreshTokenBundle.expiresAt
      }
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      sid: refreshTokenBundle.sessionId
    });

    return reply.status(200).send({
      accessToken,
      refreshToken: refreshTokenBundle.refreshToken,
      tokenType: "Bearer",
      accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m"
    });
  });

  app.post("/refresh", async (request, reply) => {
    const parseResult = refreshBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        details: parseResult.error.flatten()
      });
    }

    const refreshToken = parseResult.data.refreshToken;
    const sessionId = parseRefreshTokenSessionId(refreshToken);

    if (!sessionId) {
      return reply.status(401).send(INVALID_REFRESH_ERROR);
    }

    const existingSession = await app.prisma.session.findUnique({
      where: {
        id: sessionId
      }
    });

    if (!existingSession) {
      return reply.status(401).send(INVALID_REFRESH_ERROR);
    }

    const hashedToken = hashRefreshToken(refreshToken);

    if (existingSession.tokenHash !== hashedToken) {
      await revokeSessionFamily(app, existingSession.tokenFamilyId);
      return reply.status(401).send(REUSE_DETECTED_ERROR);
    }

    if (existingSession.revokedAt || existingSession.replacedBySessionId) {
      await revokeSessionFamily(app, existingSession.tokenFamilyId);
      return reply.status(401).send(REUSE_DETECTED_ERROR);
    }

    if (existingSession.expiresAt.getTime() <= Date.now()) {
      return reply.status(401).send(INVALID_REFRESH_ERROR);
    }

    const nextRefreshTokenBundle = buildRefreshTokenBundle({
      tokenFamilyId: existingSession.tokenFamilyId
    });

    await app.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: nextRefreshTokenBundle.sessionId,
          userId: existingSession.userId,
          tokenHash: nextRefreshTokenBundle.refreshTokenHash,
          tokenFamilyId: existingSession.tokenFamilyId,
          parentSessionId: existingSession.id,
          expiresAt: nextRefreshTokenBundle.expiresAt
        }
      });

      await tx.session.update({
        where: {
          id: existingSession.id
        },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: nextRefreshTokenBundle.sessionId
        }
      });
    });

    const accessToken = await signAccessToken({
      sub: existingSession.userId,
      sid: nextRefreshTokenBundle.sessionId
    });

    return reply.status(200).send({
      accessToken,
      refreshToken: nextRefreshTokenBundle.refreshToken,
      tokenType: "Bearer",
      accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m"
    });
  });
};

export default authRoutes;
