import Redis from "ioredis";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin = fp(async (app) => {
  const redis = new Redis(
    process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    {
      lazyConnect: true,
      maxRetriesPerRequest: 2
    }
  );

  await redis.connect();
  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await app.redis.quit();
  });
});

export default redisPlugin;
