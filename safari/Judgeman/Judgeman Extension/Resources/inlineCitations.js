(function attachInlineCitations(root, factory) {
  const api = factory();
  root.JudgemanInlineCitations = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function inlineCitationsFactory() {
  const ELIT_DEEP_BASE = "https://www.elitigation.sg/gd/s/"; // direct case path
  const ELIT_SEARCH_BASE = "https://www.elitigation.sg/gd/Home/Index"; // search fallback

  // Order matters: longest / most specific first to avoid partial matches.
  const SG_CITATION_PATTERNS = [
    /\[(\d{4})\]\s+(SGCAI|SGHCI|SGHCR|SGCA|SGHC|SGDC|SGMC|SGFC|SGPDPC|SGITBR|SGUTBR)\s+(\d+)/g, // neutral
    /\[(\d{4})\]\s+(\d+)\s+(SLR\(R\)|SLR)\s+(\d+)/g, // SLR / SLR(R)
    /\[(\d{4})\]\s+(\d+)\s+(MLJ)\s+(\d+)/g // included for completeness
  ];

  function encode(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function buildElitUrlForNeutral(year, court, number) {
    return `${ELIT_DEEP_BASE}${year}_${court}_${number}`; // [YYYY] SGXX N -> /gd/s/YYYY_SGXX_N
  }

  function buildElitSearchUrl(citation) {
    const phrase = encode(citation);
    return `${ELIT_SEARCH_BASE}?Filter=SUPCT&SearchPhrase=${phrase}&SortBy=DateOfDecision&SortAscending=False&CurrentPage=1`;
  }

  function buildElitUrl(citation) {
    const text = String(citation || "").trim();
    const neutral = text.match(/^\[(\d{4})\]\s+(SG[A-Z]{1,6})\s+(\d+)$/);
    if (neutral) {
      return buildElitUrlForNeutral(neutral[1], neutral[2], neutral[3]);
    }
    return buildElitSearchUrl(text);
  }

  function findMatches(input) {
    const text = String(input || "");
    const matches = [];
    for (const pattern of SG_CITATION_PATTERNS) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, citation: m[0] });
      }
    }
    matches.sort((a, b) => a.start - b.start);
    // suppress overlaps: keep earliest, drop later ones that overlap
    const filtered = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.start < cursor) continue;
      filtered.push(match);
      cursor = match.end;
    }
    return filtered;
  }

  function renderTextWithCitations(documentRef, text) { // returns DocumentFragment
    const doc = documentRef;
    const fragment = doc.createDocumentFragment();
    const input = String(text || "");
    const matches = findMatches(input);

    if (!matches.length) {
      fragment.appendChild(doc.createTextNode(input));
      return fragment;
    }

    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor) {
        fragment.appendChild(doc.createTextNode(input.slice(cursor, match.start)));
      }
      const anchor = doc.createElement("a");
      anchor.className = "jm-cite-link";
      anchor.textContent = match.citation;
      anchor.setAttribute("href", buildElitUrl(match.citation));
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.setAttribute("title", match.citation);
      fragment.appendChild(anchor);
      cursor = match.end;
    }
    if (cursor < input.length) {
      fragment.appendChild(doc.createTextNode(input.slice(cursor)));
    }
    return fragment;
  }

  return {
    buildElitUrl,
    findMatches,
    renderTextWithCitations
  };
});
