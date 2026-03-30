const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const extractorApi = require("../judgeman_v4/src/extractor.js");

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

test("extractCaseData returns structured ELIT judgment metadata and sections", () => {
  const dom = new JSDOM(loadFixture("elit-judgment.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);

  assert.equal(caseData.isJudgment, true);
  assert.equal(caseData.caseTitle, "Public Prosecutor v Tan Example [2024] SGHC 101");
  assert.equal(caseData.caseNumber, "HC/MA 15/2024");
  assert.equal(caseData.caseDate, "2024-03-18");
  assert.equal(caseData.caseTribunalCourt, "General Division of the High Court");
  assert.equal(caseData.caseCoram, "See Kee Oon J");
  assert.deepEqual(caseData.caseLegalIssues, [
    "Criminal Procedure and Sentencing",
    "Evidence and Witness Credibility"
  ]);
  assert.deepEqual(Object.keys(caseData.caseBody), ["Facts", "Reasoning", "Decision"]);
  assert.equal(caseData.caseBody.Facts.length, 2);
  assert.equal(caseData.caseBody.Reasoning.length, 1);
  assert.equal(
    extractorApi.sanitiseParagraph(caseData.caseBody.Decision[0]).includes("appeal is dismissed"),
    true
  );
  assert.equal(caseData.extractionErrors.length, 0);
  assert.ok(caseData.caseAnalysis);
  assert.equal(caseData.caseAnalysis.metrics.sectionCount, 3);
  assert.equal(caseData.caseAnalysis.metrics.paragraphCount, 4);
  assert.equal(caseData.caseAnalysis.brief.outcome, "Appeal dismissed");
  assert.deepEqual(caseData.caseAnalysis.citations, ["[2024] SGHC 101", "[2021] SGCA 12"]);
  assert.equal(caseData.caseAnalysis.statutoryReferences[0], "section 304A of the Penal Code.");
});

test("extractCaseData no-ops cleanly on non-judgment pages", () => {
  const dom = new JSDOM(loadFixture("elit-non-judgment.html"));
  const caseData = extractorApi.extractCaseData(dom.window.document);

  assert.equal(caseData.isJudgment, false);
  assert.equal(caseData.caseTitle, "ELIT Portal");
  assert.equal(caseData.caseLegalIssues.length, 0);
  assert.deepEqual(caseData.caseBody, {});
  assert.ok(caseData.caseAnalysis);
  assert.equal(caseData.caseAnalysis.dataQualityWarnings.includes("No judgment sections were parsed."), true);
});
