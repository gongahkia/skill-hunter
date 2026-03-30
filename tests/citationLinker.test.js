const test = require("node:test");
const assert = require("node:assert/strict");
const linker = require("../judgeman_v4/src/citationLinker.js");

test("buildLink returns SLW link for SG neutral citation", () => {
  const link = linker.buildLink("[2024] SGHC 101");
  assert.ok(link);
  assert.match(link.url, /singaporelawwatch/);
  assert.equal(link.source, "SLW / CommonLII");
});

test("buildLink returns BAILII link for UK citation", () => {
  const link = linker.buildLink("[2020] UKSC 5");
  assert.ok(link);
  assert.match(link.url, /bailii/);
  assert.equal(link.source, "BAILII");
});

test("buildLink returns AustLII link for AU citation", () => {
  const link = linker.buildLink("[2015] HCA 20");
  assert.ok(link);
  assert.match(link.url, /austlii/);
  assert.equal(link.source, "AustLII");
});

test("buildLink returns CommonLII link for MY citation", () => {
  const link = linker.buildLink("[2018] 3 MLJ 45");
  assert.ok(link);
  assert.match(link.url, /commonlii/);
  assert.equal(link.source, "CommonLII");
});

test("buildLinks maps an array of citations to links", () => {
  const links = linker.buildLinks(["[2024] SGHC 101", "[2020] UKSC 5"]);
  assert.equal(links.length, 2);
  assert.match(links[0].url, /singaporelawwatch/);
  assert.match(links[1].url, /bailii/);
});

test("buildLink falls back to CommonLII for unknown format", () => {
  const link = linker.buildLink("Some Unknown Citation 2024");
  assert.ok(link);
  assert.match(link.url, /commonlii/);
  assert.equal(link.source, "CommonLII");
});
