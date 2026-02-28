import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12)
});

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
};

export default authRoutes;
