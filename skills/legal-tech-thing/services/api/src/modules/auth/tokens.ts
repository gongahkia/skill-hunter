import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT } from "jose";

const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

type AccessTokenClaims = {
  sub: string;
  sid: string;
};

function getAccessTokenSecret(): Uint8Array {
  const secret =
    process.env.JWT_ACCESS_SECRET ??
    "dev_only_access_secret_change_me_before_production_32_chars";

  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessTokenClaims) {
  const ttl = process.env.ACCESS_TOKEN_TTL ?? DEFAULT_ACCESS_TOKEN_TTL;

  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getAccessTokenSecret());
}

export function buildRefreshTokenBundle() {
  const sessionId = randomUUID();
  const tokenFamilyId = randomUUID();
  const tokenSecret = randomBytes(48).toString("base64url");
  const refreshToken = `${sessionId}.${tokenSecret}`;
  const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
  const refreshTtlDays = Number(
    process.env.REFRESH_TOKEN_TTL_DAYS ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

  return {
    sessionId,
    tokenFamilyId,
    refreshToken,
    refreshTokenHash,
    expiresAt
  };
}
