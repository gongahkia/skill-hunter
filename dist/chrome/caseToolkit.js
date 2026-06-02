(function attachCaseToolkit(root, factory) {
  const api = factory();
  root.JudgemanCaseToolkit = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function caseToolkitFactory() {
  function safeRequire(modulePath) {
    if (typeof require !== "function") return null;
    try { return require(modulePath); } catch (_e) { return null; }
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  const citationAdapters = root.JudgemanCitationAdapters || safeRequire("./citationAdapters.js");
  const FACT_SECTION_PATTERNS = [/facts?/i, /background/i];
  const PROCEDURAL_SECTION_PATTERNS = [/procedural/i, /history/i];
  const ISSUE_SECTION_PATTERNS = [/issues?/i, /question/i];
  const HOLDING_SECTION_PATTERNS = [/decision/i, /holding/i, /conclusion/i, /orders?/i, /disposition/i];
  const RATIONALE_SECTION_PATTERNS = [/reason/i, /analysis/i, /grounds?/i];

  function sanitiseParagraph(paragraph) {
    return String(paragraph || "").replace(/^\s*\d+\s*/gm, "").replace(/\s+/g, " ").trim();
  }

  function normaliseText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitSectionEntries(caseBody) {
    const entries = [];
    for (const [title, paragraphs] of Object.entries(caseBody || {})) {
      entries.push({
        title: normaliseText(title),
        paragraphs: Array.isArray(paragraphs) ? paragraphs : []
      });
    }
    return entries;
  }

  function takeFromSections(sectionEntries, patterns, limit) {
    const selected = [];

    for (const section of sectionEntries) {
      if (!patterns.some((pattern) => pattern.test(section.title))) {
        continue;
      }

      for (const paragraph of section.paragraphs) {
        const content = sanitiseParagraph(paragraph);
        if (!content) continue;
        selected.push(content);
        if (selected.length >= limit) {
          return selected;
        }
      }
    }

    return selected;
  }

  function fallbackParagraphs(sectionEntries, limit) {
    const selected = [];
    for (const section of sectionEntries) {
      for (const paragraph of section.paragraphs) {
        const content = sanitiseParagraph(paragraph);
        if (!content) continue;
        selected.push(content);
        if (selected.length >= limit) {
          return selected;
        }
      }
    }
    return selected;
  }

  function dedupeStrings(values) {
    const seen = new Set();
    const deduped = [];

    for (const value of values || []) {
      const item = normaliseText(value);
      if (!item) continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped;
  }

  function extractNeutralCitations(text) {
    const input = String(text || "");
    const patterns = [
      /\[\d{4}\]\s+SG[A-Z]{1,6}\s+\d+/g,
      /\[\d{4}\]\s+\d+\s+SLR(?:\(R\))?\s+\d+/g,
      /\[\d{4}\]\s+\d+\s+MLJ\s+\d+/g
    ];

    const citations = [];
    for (const pattern of patterns) {
      const matches = input.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    }

    return dedupeStrings(citations);
  }

  function extractStatutoryReferences(text) {
    const input = String(text || "");
    const references = [];

    const sectionMatches = input.match(/\b(?:section|sections|s\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?(?:\s+of\s+the\s+[A-Z][A-Za-z0-9 ,.&()\/-]+)?/gi);
    const articleMatches = input.match(/\b(?:article|articles|art\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?/gi);
    const orderMatches = input.match(/\b(?:order|rule|part)\s+[A-Za-z0-9().\-]+(?:\s+[A-Za-z0-9().\-]+){0,3}/gi);

    if (sectionMatches) references.push(...sectionMatches);
    if (articleMatches) references.push(...articleMatches);
    if (orderMatches) references.push(...orderMatches);

    return dedupeStrings(references);
  }

  function detectOutcome(text) {
    const corpus = String(text || "").toLowerCase();

    const rules = [
      { pattern: /appeal(?:\s+is|\s+was)?\s+allowed/, label: "Appeal allowed" },
      { pattern: /appeal(?:\s+is|\s+was)?\s+dismissed/, label: "Appeal dismissed" },
      { pattern: /application(?:\s+is|\s+was)?\s+allowed/, label: "Application allowed" },
      { pattern: /application(?:\s+is|\s+was)?\s+dismissed/, label: "Application dismissed" },
      { pattern: /conviction(?:\s+is|\s+was)?\s+upheld/, label: "Conviction upheld" },
      { pattern: /conviction(?:\s+is|\s+was)?\s+quashed/, label: "Conviction quashed" },
      { pattern: /accused\s+is\s+acquitted|acquitted/, label: "Accused acquitted" },
      { pattern: /sentence(?:\s+is|\s+was)?\s+varied/, label: "Sentence varied" },
      { pattern: /sentence(?:\s+is|\s+was)?\s+reduced/, label: "Sentence reduced" }
    ];

    for (const rule of rules) {
      if (rule.pattern.test(corpus)) {
        return rule.label;
      }
    }

    return "Outcome not clearly detected";
  }

  function estimateReadTimeMinutes(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    if (!words) return 0;
    return Math.max(1, Math.round(words / 220));
  }

  function inferBrief(caseData) {
    const sectionEntries = splitSectionEntries(caseData?.caseBody || {});
    const maxLines = 4;

    const facts = takeFromSections(sectionEntries, FACT_SECTION_PATTERNS, maxLines);
    const proceduralHistory = takeFromSections(sectionEntries, PROCEDURAL_SECTION_PATTERNS, maxLines);
    const issues = dedupeStrings(caseData?.caseLegalIssues || []).slice(0, 8);
    const issuesFromSections = takeFromSections(sectionEntries, ISSUE_SECTION_PATTERNS, maxLines);
    const holding = takeFromSections(sectionEntries, HOLDING_SECTION_PATTERNS, maxLines);
    const rationale = takeFromSections(sectionEntries, RATIONALE_SECTION_PATTERNS, maxLines);

    const fallback = fallbackParagraphs(sectionEntries, maxLines);
    const fallbackHolding = fallbackParagraphs(sectionEntries, maxLines + 2);

    const joinedBody = Object.values(caseData?.caseBody || {})
      .flat()
      .map((paragraph) => sanitiseParagraph(paragraph))
      .join("\n");

    const outcome = detectOutcome([...(holding.length ? holding : fallbackHolding), joinedBody].join("\n"));

    return {
      facts: facts.length ? facts : fallback,
      proceduralHistory,
      issues: issues.length ? issues : issuesFromSections,
      holding: holding.length ? holding : fallbackHolding,
      rationale,
      outcome
    };
  }

  function buildDataQualityWarnings(caseData) {
    const warnings = [];

    if (!caseData?.caseTitle) warnings.push("Missing case title.");
    if (!caseData?.caseNumber) warnings.push("Missing case number.");
    if (!caseData?.caseDate) warnings.push("Missing case date.");
    if (!caseData?.caseTribunalCourt) warnings.push("Missing tribunal/court metadata.");
    if (!Array.isArray(caseData?.caseLegalIssues) || caseData.caseLegalIssues.length === 0) {
      warnings.push("No legal issues extracted from DOM labels.");
    }
    if (!caseData?.caseBody || Object.keys(caseData.caseBody).length === 0) {
      warnings.push("No judgment sections were parsed.");
    }

    return warnings;
  }

  function buildResearchChecklist(analysis) {
    const checklist = [
      "Validate extracted authorities with your jurisdictional citator before relying on them.",
      "Confirm whether referenced statutes were amended after the decision date.",
      "Review dissenting or concurring opinions for narrower ratio signals."
    ];

    if ((analysis?.citations?.length || 0) === 0) {
      checklist.push("Manually inspect the judgment for citations that were not pattern-matched.");
    }

    if ((analysis?.dataQualityWarnings?.length || 0) > 0) {
      checklist.push("Re-check metadata against the original page before downstream use.");
    }

    return checklist;
  }

  function analyseCase(caseData) {
    const caseTitle = normaliseText(caseData?.caseTitle);
    const allParagraphs = Object.values(caseData?.caseBody || {})
      .flat()
      .map((paragraph) => sanitiseParagraph(paragraph));

    const metadataText = [
      caseTitle,
      caseData?.caseNumber,
      caseData?.caseDate,
      caseData?.caseTribunalCourt,
      caseData?.caseCoram,
      caseData?.caseCounsel,
      caseData?.caseParties,
      ...(caseData?.caseLegalIssues || []),
      ...allParagraphs
    ].join("\n");

    const brief = inferBrief(caseData);
    let citations, statutes;
    if (citationAdapters?.extractAll) {
      const adapted = citationAdapters.extractAll(metadataText);
      citations = adapted.citations;
      statutes = adapted.statutes;
    } else {
      citations = extractNeutralCitations(metadataText);
      statutes = extractStatutoryReferences(metadataText);
    }
    const dataQualityWarnings = buildDataQualityWarnings(caseData);

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        sectionCount: Object.keys(caseData?.caseBody || {}).length,
        paragraphCount: allParagraphs.length,
        estimatedReadMinutes: estimateReadTimeMinutes(metadataText)
      },
      brief,
      citations,
      statutoryReferences: statutes,
      dataQualityWarnings,
      researchChecklist: buildResearchChecklist({ citations, dataQualityWarnings })
    };
  }

  function formatList(items, emptyValue) {
    if (!Array.isArray(items) || items.length === 0) {
      return [`- ${emptyValue}`];
    }
    return items.map((item) => `- ${item}`);
  }

  function buildMarkdownBrief(caseData) {
    const analysis = caseData?.caseAnalysis || analyseCase(caseData);
    const brief = analysis.brief || {};

    const lines = [
      `# ${caseData?.caseTitle || "Untitled case"}`,
      "",
      "## Snapshot",
      `- Case number: ${caseData?.caseNumber || "Not stated"}`,
      `- Date: ${caseData?.caseDate || "Not stated"}`,
      `- Tribunal/Court: ${caseData?.caseTribunalCourt || "Not stated"}`,
      `- Coram: ${caseData?.caseCoram || "Not stated"}`,
      `- Outcome signal: ${brief.outcome || "Not detected"}`,
      `- Estimated read time: ${analysis?.metrics?.estimatedReadMinutes || 0} min`,
      "",
      "## Facts",
      ...formatList(brief.facts, "No facts extracted."),
      "",
      "## Procedural History",
      ...formatList(brief.proceduralHistory, "No procedural history extracted."),
      "",
      "## Issues",
      ...formatList(brief.issues, "No issues extracted."),
      "",
      "## Holding",
      ...formatList(brief.holding, "No holding extracted."),
      "",
      "## Rationale",
      ...formatList(brief.rationale, "No rationale extracted."),
      "",
      "## Authorities",
      ...formatList(analysis?.citations, "No neutral citations detected."),
      "",
      "## Statutory References",
      ...formatList(analysis?.statutoryReferences, "No statute references detected."),
      "",
      "## Data Quality Warnings",
      ...formatList(analysis?.dataQualityWarnings, "No warnings."),
      "",
      "## Research Checklist",
      ...formatList(analysis?.researchChecklist, "No checklist generated."),
      ""
    ];

    return `${lines.join("\n").trimEnd()}\n`;
  }

  return {
    analyseCase,
    buildMarkdownBrief,
    detectOutcome,
    extractNeutralCitations,
    extractStatutoryReferences,
    sanitiseParagraph
  };
});
