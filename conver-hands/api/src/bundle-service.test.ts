import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signDigest, stableStringify } from "./crypto.js";

describe("conver-hands crypto primitives", () => {
  it("stableStringify sorts keys deterministically", () => {
    const left = stableStringify({ b: 2, a: 1 });
    const right = stableStringify({ a: 1, b: 2 });
    assert.equal(left, right);
  });

  it("signDigest creates stable signature with same secret", () => {
    const digest = "abc123";
    const secret = "test-secret";
    assert.equal(signDigest(digest, secret), signDigest(digest, secret));
  });
});
