const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const inline = require("../judgeman_v4/src/inlineCitations.js");

test("buildElitUrl maps SG neutral citation to direct ELIT case path", () => {
  assert.equal(
    inline.buildElitUrl("[2024] SGCA 12"),
    "https://www.elitigation.sg/gd/s/2024_SGCA_12"
  );
  assert.equal(
    inline.buildElitUrl("[2021] SGHC 101"),
    "https://www.elitigation.sg/gd/s/2021_SGHC_101"
  );
  assert.equal(
    inline.buildElitUrl("[2019] SGPDPC 7"),
    "https://www.elitigation.sg/gd/s/2019_SGPDPC_7"
  );
});

test("buildElitUrl falls back to ELIT search URL for SLR-style citations", () => {
  const url = inline.buildElitUrl("[2024] 1 SLR 100");
  assert.ok(url.startsWith("https://www.elitigation.sg/gd/Home/Index"));
  assert.ok(url.includes("SearchPhrase=%5B2024%5D%201%20SLR%20100"));
});

test("findMatches captures SG neutral, SLR, and SLR(R) citations", () => {
  const text = "See [2024] SGCA 12 and [2021] SGHC 101. Compare [2018] 2 SLR(R) 33 and [2000] 1 SLR 5.";
  const hits = inline.findMatches(text).map((m) => m.citation);
  assert.ok(hits.includes("[2024] SGCA 12"));
  assert.ok(hits.includes("[2021] SGHC 101"));
  assert.ok(hits.includes("[2018] 2 SLR(R) 33"));
  assert.ok(hits.includes("[2000] 1 SLR 5"));
});

test("findMatches captures SGCA(I), SGHC(R), SGHC(I) variants", () => {
  const text = "Compare [2024] SGCAI 5, [2022] SGHCR 9 and [2023] SGHCI 4.";
  const hits = inline.findMatches(text).map((m) => m.citation);
  assert.ok(hits.includes("[2024] SGCAI 5"));
  assert.ok(hits.includes("[2022] SGHCR 9"));
  assert.ok(hits.includes("[2023] SGHCI 4"));
});

test("findMatches returns empty array on text without citations", () => {
  assert.deepEqual(inline.findMatches("the parties agreed to mediate."), []);
});

test("renderTextWithCitations produces anchor elements with correct hrefs", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const fragment = inline.renderTextWithCitations(
    doc,
    "The court followed [2024] SGCA 12 and rejected [2018] 2 SLR(R) 33."
  );
  const container = doc.createElement("div");
  container.appendChild(fragment);
  const anchors = container.querySelectorAll("a.jm-cite-link");
  assert.equal(anchors.length, 2);
  assert.equal(anchors[0].textContent, "[2024] SGCA 12");
  assert.equal(anchors[0].getAttribute("href"), "https://www.elitigation.sg/gd/s/2024_SGCA_12");
  assert.equal(anchors[0].getAttribute("target"), "_blank");
  assert.equal(anchors[0].getAttribute("rel"), "noopener noreferrer");
  assert.equal(anchors[1].textContent, "[2018] 2 SLR(R) 33");
  assert.ok(anchors[1].getAttribute("href").startsWith("https://www.elitigation.sg/gd/Home/Index"));
  assert.ok(container.textContent.startsWith("The court followed "));
  assert.ok(container.textContent.endsWith("."));
});

test("renderTextWithCitations preserves text for paragraphs without citations", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const fragment = inline.renderTextWithCitations(doc, "Plain prose with no citations here.");
  const container = doc.createElement("div");
  container.appendChild(fragment);
  assert.equal(container.querySelectorAll("a").length, 0);
  assert.equal(container.textContent, "Plain prose with no citations here.");
});
