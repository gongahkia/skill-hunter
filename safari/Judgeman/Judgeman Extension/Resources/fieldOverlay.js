(function attachFieldOverlay(root, factory) {
  const api = factory();
  root.JudgemanFieldOverlay = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function fieldOverlayFactory() {
  const COURT_PATTERNS = [
    { regex: /\bSGCAI?\b/i, label: "SGCA" },
    { regex: /\bSGHC[RI]?\b/i, label: "SGHC" },
    { regex: /\bSGDC\b/i, label: "SGDC" },
    { regex: /\bSGMC\b/i, label: "SGMC" },
    { regex: /\bSGFC\b/i, label: "SGFC" },
    { regex: /\bSGPDPC\b/i, label: "SGPDPC" },
    { regex: /\bCourt of Appeal\b/i, label: "SGCA" },
    { regex: /\bAppellate Division\b/i, label: "SGHC(A)" },
    { regex: /\bGeneral Division\b/i, label: "SGHC" },
    { regex: /\bDistrict Court\b/i, label: "SGDC" },
    { regex: /\bMagistrate'?s? Court\b/i, label: "SGMC" },
    { regex: /\bFamily Court\b/i, label: "SGFC" },
    { regex: /\bPersonal Data Protection Commission\b/i, label: "SGPDPC" }
  ];

  const HOLDING_HEADING_PATTERNS = [/decision/i, /holding/i, /conclusion/i, /disposition/i, /orders?\b/i];
  const RATIO_HEADING_PATTERNS = [/reason/i, /analysis/i, /ratio/i, /grounds?\b/i];

  function normaliseText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitList(value, delimiterRegex) {
    return String(value || "")
      .split(delimiterRegex || /\s*;\s*|\s*\|\s*/)
      .map((token) => normaliseText(token))
      .filter(Boolean);
  }

  function classifyCourt(courtText, caseNumberText) {
    const source = `${courtText || ""} ${caseNumberText || ""}`;
    for (const pattern of COURT_PATTERNS) {
      if (pattern.regex.test(source)) {
        return pattern.label;
      }
    }
    return normaliseText(courtText) || "Unknown court";
  }

  function parseParties(partiesText) {
    if (!partiesText) return [];
    const tokens = splitList(partiesText, /\s*;\s*/);
    if (tokens.length >= 2) {
      const labels = ["Plaintiff/Appellant", "Defendant/Respondent"];
      return tokens.map((name, i) => ({
        role: labels[i] || `Party ${i + 1}`,
        name
      }));
    }
    const vsMatch = String(partiesText).match(/(.+?)\s+v\.?\s+(.+)/i);
    if (vsMatch) {
      return [
        { role: "Plaintiff/Appellant", name: normaliseText(vsMatch[1]) },
        { role: "Defendant/Respondent", name: normaliseText(vsMatch[2]) }
      ];
    }
    return [{ role: "Party", name: normaliseText(partiesText) }];
  }

  function parseCounsel(counselText) {
    if (!counselText) return [];
    return splitList(counselText, /\s*;\s*/);
  }

  function parseJudges(coramText) {
    if (!coramText) return [];
    return splitList(coramText, /\s*(?:;|,| and )\s*/i);
  }

  function findSectionMatching(caseBody, patterns) { // returns [{ sectionTitle, paragraphs }]
    const out = [];
    for (const [title, paragraphs] of Object.entries(caseBody || {})) {
      if (patterns.some((p) => p.test(title))) {
        out.push({ sectionTitle: title, paragraphs: Array.isArray(paragraphs) ? paragraphs : [] });
      }
    }
    return out;
  }

  function buildFieldOverlay(caseData) {
    const safe = caseData || {};
    const analysis = safe.caseAnalysis || {};
    const brief = analysis.brief || {};

    const holdingSections = findSectionMatching(safe.caseBody, HOLDING_HEADING_PATTERNS);
    const ratioSections = findSectionMatching(safe.caseBody, RATIO_HEADING_PATTERNS);

    return {
      caseTitle: normaliseText(safe.caseTitle),
      caseNumber: normaliseText(safe.caseNumber),
      court: classifyCourt(safe.caseTribunalCourt, safe.caseNumber),
      courtRaw: normaliseText(safe.caseTribunalCourt),
      judgmentDate: normaliseText(safe.caseDate),
      hearingDate: "", // ELIT info-table rarely separates these; default empty
      parties: parseParties(safe.caseParties),
      judges: parseJudges(safe.caseCoram),
      counsel: parseCounsel(safe.caseCounsel),
      legalIssues: Array.isArray(safe.caseLegalIssues) ? safe.caseLegalIssues.slice() : [],
      citationsUsed: Array.isArray(analysis.citations) ? analysis.citations.slice() : [],
      statutesCited: Array.isArray(analysis.statutoryReferences)
        ? analysis.statutoryReferences.slice()
        : [],
      holding: {
        sections: holdingSections.map((s) => s.sectionTitle),
        excerpts: Array.isArray(brief.holding) ? brief.holding.slice(0, 3) : []
      },
      ratio: {
        sections: ratioSections.map((s) => s.sectionTitle),
        excerpts: Array.isArray(brief.rationale) ? brief.rationale.slice(0, 3) : []
      },
      outcomeSignal: brief.outcome || "Not detected"
    };
  }

  return {
    buildFieldOverlay,
    classifyCourt,
    parseParties,
    parseCounsel,
    parseJudges
  };
});
