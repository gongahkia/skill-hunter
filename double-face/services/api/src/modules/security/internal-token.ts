import { SignJWT, jwtVerify } from "jose";

export type InternalTokenScope = "job-state:update";

type InternalTokenPayload = {
  scope: InternalTokenScope;
  actor: string;
};

function getInternalSecret() {
  const secret =
    process.env.INTERNAL_WEBHOOK_SECRET ??
    "dev_internal_webhook_secret_change_me_before_production";

  return new TextEncoder().encode(secret);
}

export async function signInternalToken(payload: InternalTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getInternalSecret());
}

export async function verifyInternalToken(token: string, requiredScope: InternalTokenScope) {
  const { payload } = await jwtVerify(token, getInternalSecret(), {
    algorithms: ["HS256"]
  });

  if (payload.scope !== requiredScope) {
    throw new Error("INVALID_INTERNAL_SCOPE");
  }

  return payload as InternalTokenPayload;
}
