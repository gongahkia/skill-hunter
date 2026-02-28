import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateRefreshAttempt } from "./refresh-session";

describe("evaluateRefreshAttempt", () => {
  const baseNow = new Date("2026-02-28T00:00:00.000Z");

  it("returns INVALID_REFRESH_TOKEN when session is missing", () => {
    const decision = evaluateRefreshAttempt({
      session: null,
      hashedToken: "hash-1",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "reject",
      error: "INVALID_REFRESH_TOKEN",
      revokeFamily: false
    });
  });

  it("returns TOKEN_REUSE_DETECTED and revokeFamily on token hash mismatch", () => {
    const decision = evaluateRefreshAttempt({
      session: {
        tokenHash: "stored-hash",
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date("2026-03-01T00:00:00.000Z")
      },
      hashedToken: "different-hash",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "reject",
      error: "TOKEN_REUSE_DETECTED",
      revokeFamily: true
    });
  });

  it("returns TOKEN_REUSE_DETECTED when token is already revoked", () => {
    const decision = evaluateRefreshAttempt({
      session: {
        tokenHash: "stored-hash",
        revokedAt: new Date("2026-02-27T00:00:00.000Z"),
        replacedBySessionId: null,
        expiresAt: new Date("2026-03-01T00:00:00.000Z")
      },
      hashedToken: "stored-hash",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "reject",
      error: "TOKEN_REUSE_DETECTED",
      revokeFamily: true
    });
  });

  it("returns TOKEN_REUSE_DETECTED when token has already been rotated", () => {
    const decision = evaluateRefreshAttempt({
      session: {
        tokenHash: "stored-hash",
        revokedAt: null,
        replacedBySessionId: "next-session-id",
        expiresAt: new Date("2026-03-01T00:00:00.000Z")
      },
      hashedToken: "stored-hash",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "reject",
      error: "TOKEN_REUSE_DETECTED",
      revokeFamily: true
    });
  });

  it("returns INVALID_REFRESH_TOKEN when token is expired", () => {
    const decision = evaluateRefreshAttempt({
      session: {
        tokenHash: "stored-hash",
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date("2026-02-27T23:59:59.000Z")
      },
      hashedToken: "stored-hash",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "reject",
      error: "INVALID_REFRESH_TOKEN",
      revokeFamily: false
    });
  });

  it("returns rotate decision for a valid active token", () => {
    const decision = evaluateRefreshAttempt({
      session: {
        tokenHash: "stored-hash",
        revokedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date("2026-03-01T00:00:00.000Z")
      },
      hashedToken: "stored-hash",
      now: baseNow
    });

    assert.deepEqual(decision, {
      decision: "rotate",
      revokeFamily: false
    });
  });
});
