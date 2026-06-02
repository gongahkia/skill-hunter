const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const extractorApi = require("../judgeman_v4/src/extractor.js");

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

test("extractor recognises live ELIT 2025 DOM as a judgment", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  assert.equal(caseData.isJudgment, true);
});

test("extractor parses metadata from live ELIT 2025 selectors", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  assert.ok(caseData.caseTitle.includes("Public Prosecutor"));
  assert.ok(caseData.caseTitle.includes("Nguyen Ngoc Giau"));
  assert.ok(caseData.caseTitle.includes("[2025] SGHC 999"));
  assert.equal(caseData.caseNumber, "Criminal Case No 24 of 2025");
  assert.equal(caseData.caseDate, "7 October 2025");
  assert.equal(caseData.caseTribunalCourt, "General Division of the High Court");
  assert.equal(caseData.caseCoram, "Dedar Singh Gill J");
  assert.ok(caseData.caseCounsel.includes("Public Prosecutor"));
  assert.ok(caseData.caseCounsel.includes("Accused"));
});

test("extractor reads catchwords as legal issues, stripping brackets", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  assert.equal(caseData.caseLegalIssues.length, 3);
  assert.ok(caseData.caseLegalIssues[0].startsWith("Criminal Law"));
  assert.ok(!caseData.caseLegalIssues[0].startsWith("["));
});

test("extractor parses parties from txt-body.text-left blocks", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  assert.ok(caseData.caseParties.includes("Public Prosecutor"));
  assert.ok(caseData.caseParties.includes("Nguyen Ngoc Giau"));
});

test("extractor groups Judg-Heading-1 + Judg-1 in document order with pre-heading Introduction", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  const titles = Object.keys(caseData.caseBody);
  assert.deepEqual(titles, ["Introduction", "Background facts", "My findings"]);
  assert.equal(caseData.caseBody.Introduction.length, 2);
  assert.ok(caseData.caseBody["Background facts"].length >= 2);
  assert.equal(caseData.caseBody["My findings"].length, 1);
});

test("extractor strips footnote modals from body paragraph text", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  const para4 = caseData.caseBody["Background facts"].find((p) => p.startsWith("4"));
  assert.ok(para4);
  assert.ok(!para4.includes("Foot Note"), `paragraph 4 should not include footnote modal text, got: ${para4}`);
  assert.ok(!para4.includes("Agreed Statement of Facts"), `paragraph 4 should not include FootnoteRef body, got: ${para4}`);
  assert.ok(para4.includes("43-year-old Vietnamese national"));
  assert.ok(para4.includes("51 years old"));
});

test("extractor surfaces inline citation through analysis layer on live fixture", () => {
  const dom = new JSDOM(loadFixture("elit-live-2025-sghc.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);
  assert.ok(caseData.caseAnalysis);
  assert.ok(caseData.caseAnalysis.citations.includes("[2024] SGCA 12"));
});
