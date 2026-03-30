const test = require("node:test");
const assert = require("node:assert/strict");
const adapters = require("../judgeman_v4/src/citationAdapters.js");

test("SG adapter extracts Singapore neutral citations", () => {
  const sg = adapters.getAdapter("SG");
  assert.ok(sg);
  const hits = sg.extractCitations("See [2024] SGHC 101 and [2021] SGCA 12.");
  assert.deepEqual(hits, ["[2024] SGHC 101", "[2021] SGCA 12"]);
});

test("UK adapter extracts UKSC and EWCA citations", () => {
  const uk = adapters.getAdapter("UK");
  assert.ok(uk);
  const hits = uk.extractCitations("Relied on [2020] UKSC 5 and [2019] EWCA Civ 300.");
  assert.deepEqual(hits, ["[2020] UKSC 5", "[2019] EWCA Civ 300"]);
});

test("MY adapter extracts Malaysian citations", () => {
  const my = adapters.getAdapter("MY");
  assert.ok(my);
  const hits = my.extractCitations("Cited [2018] 3 MLJ 45 and [2020] MYCA 12.");
  assert.deepEqual(hits, ["[2018] 3 MLJ 45", "[2020] MYCA 12"]);
});

test("AU adapter extracts Australian citations", () => {
  const au = adapters.getAdapter("AU");
  assert.ok(au);
  const hits = au.extractCitations("Applied [2015] HCA 20 and (2014) 250 CLR 1.");
  assert.deepEqual(hits, ["[2015] HCA 20", "(2014) 250 CLR 1"]);
});

test("extractAll merges results across all adapters", () => {
  const result = adapters.extractAll(
    "See [2024] SGHC 101 and [2020] UKSC 5 and section 12 of the Evidence Act."
  );
  assert.ok(result.citations.includes("[2024] SGHC 101"));
  assert.ok(result.citations.includes("[2020] UKSC 5"));
  assert.ok(result.statutes.length > 0);
});

test("listJurisdictions returns all registered adapters", () => {
  const jurisdictions = adapters.listJurisdictions();
  assert.ok(jurisdictions.includes("SG"));
  assert.ok(jurisdictions.includes("UK"));
  assert.ok(jurisdictions.includes("MY"));
  assert.ok(jurisdictions.includes("AU"));
});
