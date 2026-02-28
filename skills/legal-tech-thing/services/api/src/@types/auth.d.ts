export {};

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      sessionId: string;
    };
  }
}
