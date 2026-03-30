const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const extractorApi = require("../judgeman_v4/src/extractor.js");

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

test("civil fixture extracts contract and tort legal issues", () => {
  const dom = new JSDOM(loadFixture("elit-civil.html"));
  const data = extractorApi.extractCaseData(dom.window.document);
  assert.equal(data.isJudgment, true);
  assert.equal(data.caseTitle, "Lim Ah Kow v Tan Boon Huat [2023] SGHC 250");
  assert.equal(data.caseNumber, "HC/S 412/2022");
  assert.equal(data.caseTribunalCourt, "General Division of the High Court");
  assert.ok(data.caseLegalIssues.length >= 2);
  assert.ok(data.caseLegalIssues.some((i) => /Contract/.test(i)));
  assert.ok(data.caseLegalIssues.some((i) => /Negligence/.test(i)));
  assert.deepEqual(Object.keys(data.caseBody), ["Background", "Issues", "Analysis", "Orders"]);
  assert.equal(data.caseBody.Background.length, 3);
  assert.equal(data.caseBody.Orders.length, 2);
  assert.equal(data.extractionErrors.length, 0);
  assert.ok(data.caseAnalysis);
  assert.ok(data.caseAnalysis.citations.includes("[2023] SGHC 250"));
  assert.ok(data.caseAnalysis.statutoryReferences.some((r) => /section 6 of the Civil Law Act/.test(r)));
});

test("appellate fixture extracts appeal outcome and MDA statute", () => {
  const dom = new JSDOM(loadFixture("elit-appellate.html"));
  const data = extractorApi.extractCaseData(dom.window.document);
  assert.equal(data.isJudgment, true);
  assert.equal(data.caseTitle, "Chen Wei v Public Prosecutor [2024] SGCA 8");
  assert.equal(data.caseNumber, "CA/CCA 5/2023");
  assert.equal(data.caseTribunalCourt, "Court of Appeal");
  assert.equal(data.caseCoram, "Sundaresh Menon CJ");
  assert.ok(data.caseLegalIssues.some((i) => /Misuse of Drugs/.test(i)));
  assert.deepEqual(Object.keys(data.caseBody), ["Introduction", "Grounds of Appeal", "Decision of the Court"]);
  assert.equal(data.caseAnalysis.brief.outcome, "Appeal dismissed");
  assert.ok(data.caseAnalysis.citations.includes("[2024] SGCA 8"));
  assert.ok(data.caseAnalysis.citations.includes("[2023] SGHC 55"));
  assert.ok(data.caseAnalysis.statutoryReferences.some((r) => /section 5/.test(r)));
});

test("multi-judge fixture extracts coram with three judges", () => {
  const dom = new JSDOM(loadFixture("elit-multi-judge.html"));
  const data = extractorApi.extractCaseData(dom.window.document);
  assert.equal(data.isJudgment, true);
  assert.equal(data.caseTitle, "Keppel Corp Ltd v Sembcorp Marine Ltd [2024] SGCA 15");
  assert.equal(data.caseNumber, "CA/CA 50/2023");
  assert.match(data.caseCoram, /Sundaresh Menon CJ/);
  assert.match(data.caseCoram, /Andrew Phang Boon Leong JCA/);
  assert.match(data.caseCoram, /Judith Prakash JCA/);
  assert.ok(data.caseLegalIssues.some((i) => /Directors/.test(i)));
  const sections = Object.keys(data.caseBody);
  assert.ok(sections.includes("Majority Judgment (Menon CJ and Phang JCA)"));
  assert.ok(sections.includes("Dissenting Judgment (Prakash JCA)"));
  assert.ok(sections.includes("Orders"));
  assert.equal(data.caseAnalysis.brief.outcome, "Appeal allowed");
  assert.ok(data.caseAnalysis.citations.includes("[2024] SGCA 15"));
  assert.ok(data.caseAnalysis.statutoryReferences.some((r) => /section 157 of the Companies Act/.test(r)));
});
