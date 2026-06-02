const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const statutes = require("../judgeman_v4/src/inlineStatutes.js");

test("normaliseActName strips trailing years, Cap suffixes, and casing", () => {
  assert.equal(statutes.normaliseActName("The Penal Code 1871"), "penal code");
  assert.equal(statutes.normaliseActName("Penal Code (Cap 224)"), "penal code");
  assert.equal(statutes.normaliseActName("Misuse of Drugs Act"), "misuse of drugs act");
});

test("lookupActSlug resolves top SG acts", () => {
  assert.equal(statutes.lookupActSlug("Penal Code 1871"), "PC1871");
  assert.equal(statutes.lookupActSlug("the Penal Code (Cap 224)"), "PC1871");
  assert.equal(statutes.lookupActSlug("Misuse of Drugs Act"), "MDA1973");
  assert.equal(statutes.lookupActSlug("Road Traffic Act"), "RTA1961");
  assert.equal(statutes.lookupActSlug("Personal Data Protection Act"), "PDPA2012");
  assert.equal(statutes.lookupActSlug("Made-Up Speeding Act 2099"), null);
});

test("ACT_TO_SLUG ships at least 50 mappings", () => {
  assert.ok(Object.keys(statutes.ACT_TO_SLUG).length >= 50);
});

test("buildSsoUrl renders provision deep-links and bare act URLs", () => {
  assert.equal(
    statutes.buildSsoUrl({ kind: "act", slug: "PC1871", provision: "23" }),
    "https://sso.agc.gov.sg/Act/PC1871?ProvIds=pr23-"
  );
  assert.equal(
    statutes.buildSsoUrl({ kind: "act", slug: "PC1871", provision: "23(1)(a)" }),
    "https://sso.agc.gov.sg/Act/PC1871?ProvIds=pr231a-"
  );
  assert.equal(
    statutes.buildSsoUrl({ kind: "act", slug: "PC1871" }),
    "https://sso.agc.gov.sg/Act/PC1871"
  );
  assert.equal(statutes.buildSsoUrl({ kind: "act", slug: null }), null);
});

test("findStatuteMatches resolves linkable section references", () => {
  const text = "Convicted under section 304A of the Penal Code 1871 and s 5 of the Misuse of Drugs Act.";
  const matches = statutes.findStatuteMatches(text);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].provision, "304A");
  assert.equal(matches[0].slug, "PC1871");
  assert.equal(matches[0].resolved, true);
  assert.ok(matches[0].url.includes("PC1871"));
  assert.ok(matches[0].url.includes("pr304A-"));
  assert.equal(matches[1].slug, "MDA1973");
});

test("findStatuteMatches marks unknown acts as unresolved", () => {
  const text = "Per s 5 of the Imaginary Speeding Act 2099 the accused was charged.";
  const matches = statutes.findStatuteMatches(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].resolved, false);
  assert.equal(matches[0].url, null);
});

test("findStatuteMatches captures regulation-of-Rules references", () => {
  const text = "Breached reg 5(2) of the Road Traffic (Motor Vehicles, Speed Limits) Rules.";
  const matches = statutes.findStatuteMatches(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "regulation");
  assert.equal(matches[0].resolved, false);
});

test("findStatuteMatches captures Order-Rule references with no link", () => {
  const text = "Pleaded under O 14 r 1 for summary judgment.";
  const matches = statutes.findStatuteMatches(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "order");
  assert.equal(matches[0].resolved, false);
});

test("renderTextWithStatutes builds anchors for resolved acts and spans for unresolved", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const fragment = statutes.renderTextWithStatutes(
    doc,
    "Charged under section 304A of the Penal Code 1871. See also s 1 of the Made-Up Act 2099."
  );
  const container = doc.createElement("div");
  container.appendChild(fragment);

  const resolvedAnchors = container.querySelectorAll("a.jm-statute-resolved");
  assert.equal(resolvedAnchors.length, 1);
  assert.equal(resolvedAnchors[0].getAttribute("href"), "https://sso.agc.gov.sg/Act/PC1871?ProvIds=pr304A-");
  assert.equal(resolvedAnchors[0].getAttribute("target"), "_blank");

  const unresolvedSpans = container.querySelectorAll("span.jm-statute-unresolved");
  assert.equal(unresolvedSpans.length, 1);
  assert.ok(unresolvedSpans[0].getAttribute("title").includes("Made-Up Act"));
});

test("renderTextWithStatutes returns plain text when no statute references", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const fragment = statutes.renderTextWithStatutes(doc, "No statute references in this prose.");
  const container = doc.createElement("div");
  container.appendChild(fragment);
  assert.equal(container.querySelectorAll("a").length, 0);
  assert.equal(container.querySelectorAll("span.jm-statute-unresolved").length, 0);
  assert.equal(container.textContent, "No statute references in this prose.");
});
