const test = require("node:test");
const assert = require("node:assert/strict");
const loggerApi = require("../judgeman_v4/src/logger.js");

test("logger captures namespace entries and serialises diagnostics", () => {
  const logger = loggerApi.createLogger({ namespace: "LoggerTest", maxEntries: 3 });

  logger.info("step_one", { ok: true });
  logger.warn("step_two", { warning: true });
  logger.error("step_three", new Error("boom"));

  const entries = logger.entries();
  assert.equal(entries.length, 3);
  assert.equal(entries[2].event, "step_three");

  const diagnostics = logger.exportText({ source: "unit-test" });
  assert.match(diagnostics, /"namespace": "LoggerTest"/);
  assert.match(diagnostics, /"step_three"/);
});
