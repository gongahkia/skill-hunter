export type RefreshSessionState = {
  tokenHash: string;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  expiresAt: Date;
};

export type RefreshAttemptDecision =
  | {
      decision: "rotate";
      revokeFamily: false;
    }
  | {
      decision: "reject";
      error: "INVALID_REFRESH_TOKEN" | "TOKEN_REUSE_DETECTED";
      revokeFamily: boolean;
    };

export function evaluateRefreshAttempt(input: {
  session: RefreshSessionState | null;
  hashedToken: string;
  now?: Date;
}): RefreshAttemptDecision {
  const { session, hashedToken } = input;
  const now = input.now ?? new Date();

  if (!session) {
    return {
      decision: "reject",
      error: "INVALID_REFRESH_TOKEN",
      revokeFamily: false
    };
  }

  if (session.tokenHash !== hashedToken) {
    return {
      decision: "reject",
      error: "TOKEN_REUSE_DETECTED",
      revokeFamily: true
    };
  }

  if (session.revokedAt || session.replacedBySessionId) {
    return {
      decision: "reject",
      error: "TOKEN_REUSE_DETECTED",
      revokeFamily: true
    };
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    return {
      decision: "reject",
      error: "INVALID_REFRESH_TOKEN",
      revokeFamily: false
    };
  }

  return {
    decision: "rotate",
    revokeFamily: false
  };
}
