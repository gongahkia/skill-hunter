(function attachCitationLinker(root, factory) {
  const api = factory();
  root.JudgemanCitationLinker = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function citationLinkerFactory() {
  const SLW_BASE = "https://www.singaporelawwatch.sg/Portals/0/Docs/Judgments/";
  const COMMONLII_SG = "https://www.commonlii.org/cgi-bin/sinosrch.cgi?method=boolean&query=";
  const BAILII_BASE = "https://www.bailii.org/cgi-bin/find_by_citation.cgi?citation=";
  const AUSTLII_BASE = "https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?method=boolean&query=";
  const MLJ_COMMONLII = "https://www.commonlii.org/cgi-bin/sinosrch.cgi?method=boolean&query=";

  function encodeCitation(citation) {
    return encodeURIComponent(String(citation || "").trim());
  }

  function parseSgNeutral(citation) { // returns { year, court, number } or null
    const m = String(citation || "").match(/\[(\d{4})\]\s+(SG[A-Z]{1,6})\s+(\d+)/);
    if (!m) return null;
    return { year: m[1], court: m[2], number: m[3] };
  }

  function buildLink(citation) {
    const text = String(citation || "").trim();
    if (!text) return null;
    const sg = parseSgNeutral(text);
    if (sg) {
      return {
        citation: text,
        url: `${SLW_BASE}[${sg.year}]%20${sg.court}%20${sg.number}.pdf`,
        fallbackUrl: `${COMMONLII_SG}${encodeCitation(text)}`,
        source: "SLW / CommonLII"
      };
    }
    if (/\[\d{4}\]\s+(?:UKSC|UKHL|EWCA|EWHC)/.test(text)) {
      return { citation: text, url: `${BAILII_BASE}${encodeCitation(text)}`, source: "BAILII" };
    }
    if (/\[\d{4}\]\s+\d+\s+(?:WLR|AC|All\s+ER)/.test(text)) {
      return { citation: text, url: `${BAILII_BASE}${encodeCitation(text)}`, source: "BAILII" };
    }
    if (/\[\d{4}\]\s+(?:HCA|FCA|FCAFC|NSWCA|NSWSC|VSCA|VSC)/.test(text)) {
      return { citation: text, url: `${AUSTLII_BASE}${encodeCitation(text)}`, source: "AustLII" };
    }
    if (/\(\d{4}\)\s+\d+\s+CLR/.test(text)) {
      return { citation: text, url: `${AUSTLII_BASE}${encodeCitation(text)}`, source: "AustLII" };
    }
    if (/\[\d{4}\]\s+\d+\s+(?:MLJ|CLJ)/.test(text) || /\[\d{4}\]\s+(?:MYFC|MYCA|MLJU)/.test(text)) {
      return { citation: text, url: `${MLJ_COMMONLII}${encodeCitation(text)}`, source: "CommonLII" };
    }
    return { citation: text, url: `${COMMONLII_SG}${encodeCitation(text)}`, source: "CommonLII" }; // generic fallback
  }

  function buildLinks(citations) {
    return (citations || []).map(buildLink).filter(Boolean);
  }

  return { buildLink, buildLinks };
});
