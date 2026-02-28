import { compare, hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { buildRefreshTokenBundle, signAccessToken } from "../modules/auth/tokens";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12)
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const INVALID_CREDENTIALS_ERROR = {
  error: "INVALID_CREDENTIALS"
} as const;

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
};

export default authRoutes;
