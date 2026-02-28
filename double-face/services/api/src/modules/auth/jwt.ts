import { jwtVerify } from "jose";

export type AccessTokenPayload = {
  userId: string;
  sessionId: string;
};

function getAccessTokenSecret(): Uint8Array {
  const secret =
    process.env.JWT_ACCESS_SECRET ??
    "dev_only_access_secret_change_me_before_production_32_chars";

  return new TextEncoder().encode(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessTokenSecret(), {
    algorithms: ["HS256"]
  });

  if (typeof payload.sub !== "string") {
    throw new Error("JWT_SUB_MISSING");
  }

  if (typeof payload.sid !== "string") {
    throw new Error("JWT_SESSION_MISSING");
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid
  };
}
