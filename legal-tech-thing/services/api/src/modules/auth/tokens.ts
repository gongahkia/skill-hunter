import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT } from "jose";

const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

type AccessTokenClaims = {
  sub: string;
  sid: string;
};

type RefreshTokenBundleOptions = {
  tokenFamilyId?: string;
};

function getAccessTokenSecret(): Uint8Array {
  const secret =
    process.env.JWT_ACCESS_SECRET ??
    "dev_only_access_secret_change_me_before_production_32_chars";

  return new TextEncoder().encode(secret);
}

function getRefreshTtlDays() {
  return Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS);
}

export function hashRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

export function parseRefreshTokenSessionId(refreshToken: string) {
  const [sessionId] = refreshToken.split(".");

  if (!sessionId) {
    return null;
  }

  return sessionId;
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

export function buildRefreshTokenBundle(options: RefreshTokenBundleOptions = {}) {
  const sessionId = randomUUID();
  const tokenFamilyId = options.tokenFamilyId ?? randomUUID();
  const tokenSecret = randomBytes(48).toString("base64url");
  const refreshToken = `${sessionId}.${tokenSecret}`;
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + getRefreshTtlDays());

  return {
    sessionId,
    tokenFamilyId,
    refreshToken,
    refreshTokenHash,
    expiresAt
  };
}
