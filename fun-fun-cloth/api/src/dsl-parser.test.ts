import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compilePolicyDsl } from "./dsl-parser.js";
import { simulatePolicy } from "./simulator.js";

describe("fun-fun-cloth DSL", () => {
  const dsl = `POLICY "P1"
RULE r1
WHEN CLAUSE TYPE LIABILITY
REQUIRE /cap liability/i
FORBID /unlimited liability/i
SEVERITY high
REMEDIATION "Add a cap"
END`;

  it("compiles valid DSL", () => {
    const compiled = compilePolicyDsl(dsl);
    assert.equal(compiled.rules.length, 1);
    assert.equal(compiled.rules[0]?.id, "r1");
  });

  it("simulates violations on contract text", () => {
    const compiled = compilePolicyDsl(dsl);
    const simulation = simulatePolicy(compiled, "Liability clause: liability is unlimited.");
    assert.equal(simulation.violations.length > 0, true);
  });
});
