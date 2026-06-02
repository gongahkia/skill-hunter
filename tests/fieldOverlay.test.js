const test = require("node:test");
const assert = require("node:assert/strict");
const overlay = require("../judgeman_v4/src/fieldOverlay.js");

function makeCaseData(extra) {
  return Object.assign(
    {
      caseTitle: "Public Prosecutor v Tan Example [2024] SGHC 101",
      caseNumber: "HC/MA 15/2024",
      caseDate: "2024-03-18",
      caseTribunalCourt: "General Division of the High Court",
      caseCoram: "See Kee Oon J",
      caseCounsel: "Ms Example for the Prosecution; Mr Other for the Accused",
      caseParties: "Public Prosecutor; Tan Example",
      caseLegalIssues: ["Criminal Procedure", "Evidence"],
      caseBody: {
        Facts: ["1 The accused..."],
        Reasoning: ["2 The court applied..."],
        Decision: ["3 Appeal dismissed."]
      },
      caseAnalysis: {
        citations: ["[2021] SGCA 12", "[2018] 2 SLR(R) 33"],
        statutoryReferences: ["section 304A of the Penal Code"],
        brief: {
          outcome: "Appeal dismissed",
          holding: ["Appeal dismissed and conviction upheld."],
          rationale: ["The court applied the framework in Lim v PP."]
        }
      }
    },
    extra || {}
  );
}

test("buildFieldOverlay returns structured fields with court classification", () => {
  const fields = overlay.buildFieldOverlay(makeCaseData());
  assert.equal(fields.court, "SGHC");
  assert.equal(fields.caseNumber, "HC/MA 15/2024");
  assert.equal(fields.judgmentDate, "2024-03-18");
  assert.deepEqual(fields.judges, ["See Kee Oon J"]);
  assert.deepEqual(fields.parties, [
    { role: "Plaintiff/Appellant", name: "Public Prosecutor" },
    { role: "Defendant/Respondent", name: "Tan Example" }
  ]);
  assert.equal(fields.counsel.length, 2);
  assert.equal(fields.outcomeSignal, "Appeal dismissed");
});

test("buildFieldOverlay locates holding and ratio sections by heading", () => {
  const fields = overlay.buildFieldOverlay(makeCaseData());
  assert.deepEqual(fields.holding.sections, ["Decision"]);
  assert.deepEqual(fields.ratio.sections, ["Reasoning"]);
  assert.ok(fields.holding.excerpts.length > 0);
  assert.ok(fields.ratio.excerpts.length > 0);
});

test("classifyCourt recognises SGCA, SGHC, SGDC, SGMC, SGFC, SGPDPC", () => {
  assert.equal(overlay.classifyCourt("Court of Appeal", "CA/CA 1/2024"), "SGCA");
  assert.equal(overlay.classifyCourt("Appellate Division of the High Court", ""), "SGHC(A)");
  assert.equal(overlay.classifyCourt("District Court", ""), "SGDC");
  assert.equal(overlay.classifyCourt("Magistrate's Court", ""), "SGMC");
  assert.equal(overlay.classifyCourt("Family Court", ""), "SGFC");
  assert.equal(overlay.classifyCourt("Personal Data Protection Commission", "DP/2024/01"), "SGPDPC");
  assert.equal(overlay.classifyCourt("", "[2024] SGCA 12"), "SGCA");
  assert.equal(overlay.classifyCourt("", ""), "Unknown court");
});

test("parseParties handles semicolon-delimited and v.-style party strings", () => {
  assert.deepEqual(overlay.parseParties("Acme Ltd; Beta Pte"), [
    { role: "Plaintiff/Appellant", name: "Acme Ltd" },
    { role: "Defendant/Respondent", name: "Beta Pte" }
  ]);
  assert.deepEqual(overlay.parseParties("Acme Ltd v Beta Pte"), [
    { role: "Plaintiff/Appellant", name: "Acme Ltd" },
    { role: "Defendant/Respondent", name: "Beta Pte" }
  ]);
  assert.deepEqual(overlay.parseParties(""), []);
  assert.deepEqual(overlay.parseParties("Solo Party"), [
    { role: "Party", name: "Solo Party" }
  ]);
});

test("parseJudges splits on commas, semicolons, and ' and '", () => {
  assert.deepEqual(
    overlay.parseJudges("Sundaresh Menon CJ, Judith Prakash JCA and Steven Chong JCA"),
    ["Sundaresh Menon CJ", "Judith Prakash JCA", "Steven Chong JCA"]
  );
  assert.deepEqual(overlay.parseJudges(""), []);
});

test("buildFieldOverlay gracefully handles minimal case data", () => {
  const fields = overlay.buildFieldOverlay({});
  assert.equal(fields.court, "Unknown court");
  assert.equal(fields.caseNumber, "");
  assert.deepEqual(fields.parties, []);
  assert.deepEqual(fields.judges, []);
  assert.deepEqual(fields.citationsUsed, []);
  assert.deepEqual(fields.statutesCited, []);
  assert.deepEqual(fields.holding.sections, []);
  assert.deepEqual(fields.ratio.sections, []);
});
