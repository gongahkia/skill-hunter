import type Redis from "ioredis";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS_PER_IP = 60;
const MAX_ATTEMPTS_PER_EMAIL = 20;

export type AuthRateLimitResult = {
  isLimited: boolean;
  retryAfterSeconds: number;
};

async function incrementWithWindow(redis: Redis, key: string) {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  const ttl = await redis.ttl(key);

  return {
    count,
    ttl: ttl > 0 ? ttl : WINDOW_SECONDS
  };
}

export async function checkAuthRateLimit(
  redis: Redis,
  ip: string,
  email?: string
): Promise<AuthRateLimitResult> {
  const ipResult = await incrementWithWindow(redis, `auth:ip:${ip}`);

  if (ipResult.count > MAX_ATTEMPTS_PER_IP) {
    return {
      isLimited: true,
      retryAfterSeconds: ipResult.ttl
    };
  }

  if (!email) {
    return {
      isLimited: false,
      retryAfterSeconds: 0
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailResult = await incrementWithWindow(
    redis,
    `auth:email:${normalizedEmail}`
  );

  if (emailResult.count > MAX_ATTEMPTS_PER_EMAIL) {
    return {
      isLimited: true,
      retryAfterSeconds: emailResult.ttl
    };
  }

  return {
    isLimited: false,
    retryAfterSeconds: 0
  };
}
