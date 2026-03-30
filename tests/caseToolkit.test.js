const test = require("node:test");
const assert = require("node:assert/strict");
const caseToolkit = require("../judgeman_v4/src/caseToolkit.js");

test("analyseCase extracts briefing signals and references", () => {
  const analysis = caseToolkit.analyseCase({
    caseTitle: "Foo v Bar [2023] SGCA 4",
    caseNumber: "CA/12/2023",
    caseDate: "2023-02-19",
    caseTribunalCourt: "Court of Appeal",
    caseCoram: "Justice Example",
    caseCounsel: "Ms Counsel",
    caseParties: "Foo; Bar",
    caseLegalIssues: ["Negligence", "Causation"],
    caseBody: {
      Facts: [
        "1 The claimant relied on section 12 of the Evidence Act.",
        "2 The dispute concerned contractual duty."
      ],
      Decision: ["3 The appeal is dismissed and conviction upheld."]
    }
  });

  assert.equal(analysis.brief.outcome, "Appeal dismissed");
  assert.deepEqual(analysis.citations, ["[2023] SGCA 4"]);
  assert.equal(analysis.statutoryReferences.includes("section 12 of the Evidence Act."), true);
  assert.equal(analysis.metrics.sectionCount, 2);
  assert.equal(analysis.metrics.paragraphCount, 3);
});

test("buildMarkdownBrief returns a complete markdown scaffold", () => {
  const markdown = caseToolkit.buildMarkdownBrief({
    caseTitle: "Foo v Bar [2023] SGCA 4",
    caseNumber: "CA/12/2023",
    caseDate: "2023-02-19",
    caseTribunalCourt: "Court of Appeal",
    caseCoram: "Justice Example",
    caseLegalIssues: ["Negligence"],
    caseBody: {
      Facts: ["1 Basic facts."],
      Decision: ["2 The appeal is dismissed."]
    }
  });

  assert.match(markdown, /^# Foo v Bar \[2023\] SGCA 4/m);
  assert.match(markdown, /^## Snapshot/m);
  assert.match(markdown, /^## Issues/m);
  assert.match(markdown, /^## Research Checklist/m);
});
