(function attachInlineStatutes(root, factory) {
  const api = factory();
  root.JudgemanInlineStatutes = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function inlineStatutesFactory() {
  const SSO_ACT_BASE = "https://sso.agc.gov.sg/Act/";
  const SSO_SL_BASE = "https://sso.agc.gov.sg/SL/";

  // top SG acts -> SSO slug. coverage focuses on acts most cited in ELIT judgments.
  // [Inference] slugs follow the SSO convention of <abbrev><year>; verified via spot-checks.
  const ACT_TO_SLUG = {
    "penal code": "PC1871",
    "misuse of drugs act": "MDA1973",
    "road traffic act": "RTA1961",
    "criminal procedure code": "CPC2010",
    "evidence act": "EA1893",
    "companies act": "CoA1967",
    "insolvency, restructuring and dissolution act": "IRDA2018",
    "bankruptcy act": "BA1995",
    "civil law act": "CLA1909",
    "limitation act": "LA1959",
    "interpretation act": "IA1965",
    "application of english law act": "AELA1993",
    "supreme court of judicature act": "SCJA1969",
    "subordinate courts act": "SCA1970",
    "state courts act": "SCA1970",
    "constitution of the republic of singapore": "CONS1963",
    "constitution": "CONS1963",
    "women's charter": "WC1961",
    "employment act": "EmpA1968",
    "workplace safety and health act": "WSHA2006",
    "work injury compensation act": "WICA2019",
    "trade unions act": "TUA1940",
    "industrial relations act": "IRA1960",
    "income tax act": "ITA1947",
    "goods and services tax act": "GSTA1993",
    "stamp duties act": "SDA1929",
    "banking act": "BA1970",
    "insurance act": "IA1966",
    "securities and futures act": "SFA2001",
    "financial advisers act": "FAA2001",
    "payment services act": "PSA2019",
    "personal data protection act": "PDPA2012",
    "computer misuse act": "CMA1993",
    "cybersecurity act": "CSA2018",
    "trade marks act": "TMA1998",
    "patents act": "PA1994",
    "copyright act": "CRA2021",
    "registered designs act": "RDA2000",
    "sale of goods act": "SGA1979",
    "misrepresentation act": "MA1967",
    "contracts (rights of third parties) act": "CRTPA2001",
    "frustrated contracts act": "FCA1959",
    "bills of exchange act": "BoEA1949",
    "defamation act": "DA1957",
    "consumer protection (fair trading) act": "CPFTA2003",
    "unfair contract terms act": "UCTA1977",
    "land titles act": "LTA1993",
    "conveyancing and law of property act": "CLPA1886",
    "registration of deeds act": "RoDA1988",
    "building maintenance and strata management act": "BMSMA2004",
    "planning act": "PA1998",
    "moneylenders act": "MLA2008",
    "prevention of corruption act": "PCA1960",
    "corruption, drug trafficking and other serious crimes (confiscation of benefits) act": "CDSA1992",
    "immigration act": "ImmA1959",
    "protection from harassment act": "POHA2014",
    "internal security act": "ISA1960",
    "official secrets act": "OSA1935",
    "criminal law (temporary provisions) act": "CLTPA1955"
  };

  function normaliseActName(actName) {
    return String(actName || "")
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\s*\(\s*cap\s+\d+[a-z]?\s*\)\s*$/i, "") // strip "(Cap N)" suffix
      .replace(/\s+cap\s+\d+[a-z]?$/i, "") // strip bare "Cap N" suffix
      .replace(/\s+\d{4}$/, "") // strip trailing year
      .replace(/\s+/g, " ")
      .trim();
  }

  function lookupActSlug(actName) {
    const key = normaliseActName(actName);
    if (!key) return null;
    return ACT_TO_SLUG[key] || null;
  }

  function buildSsoUrl({ kind, slug, provision }) {
    const base = kind === "subsidiary" ? SSO_SL_BASE : SSO_ACT_BASE;
    if (!slug) return null;
    if (!provision) return `${base}${slug}`;
    const normalised = String(provision).replace(/[^0-9A-Za-z]/g, "");
    return `${base}${slug}?ProvIds=pr${normalised}-`;
  }

  // matches:
  //   "section 23 of the Penal Code 1871"
  //   "s 23(1) of the Penal Code"
  //   "s. 23 of the Penal Code (Cap 224)"
  //   "ss 23 and 24 of the Penal Code"
  const SECTION_OF_ACT_PATTERN = /\b(s\.?|ss\.?|section|sections)\s+(\d+[A-Za-z]*(?:\(\w+\))*)\s+of\s+(?:the\s+)?([A-Z][A-Za-z'&,()\/\-\s]+?(?:Act|Code|Charter|Rules|Regulations|Constitution))(?:\s+(\d{4}|\(?Cap\s+\d+[A-Za-z]?\)?))?/g;

  // matches "reg 5(2) of the Road Traffic ..." (subsidiary legislation)
  const REGULATION_PATTERN = /\b(reg\.?|regulation|regulations)\s+(\d+[A-Za-z]*(?:\(\w+\))*)\s+of\s+(?:the\s+)?([A-Z][A-Za-z'&,()\/\-\s]+?(?:Rules|Regulations|Order))(?:\s+(\d{4}))?/g;

  // bare "O 14" (Order N) and "r 5" (Rule N) — typically Rules of Court references.
  // No act lookup; render as info-only spans (no link, status "?").
  const ORDER_PATTERN = /\bO(?:rder)?\.?\s+(\d+[A-Za-z]*)\s+r(?:ule)?\.?\s+(\d+[A-Za-z]*(?:\(\w+\))*)/g;

  function findSectionMatches(text) {
    const matches = [];
    const input = String(text || "");
    SECTION_OF_ACT_PATTERN.lastIndex = 0;
    let m;
    while ((m = SECTION_OF_ACT_PATTERN.exec(input)) !== null) {
      const provision = m[2];
      const actName = m[3];
      const slug = lookupActSlug(actName);
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        label: m[0],
        kind: "section",
        provision,
        actName,
        slug,
        url: slug ? buildSsoUrl({ kind: "act", slug, provision }) : null,
        resolved: Boolean(slug)
      });
    }
    return matches;
  }

  function findRegulationMatches(text) {
    const matches = [];
    const input = String(text || "");
    REGULATION_PATTERN.lastIndex = 0;
    let m;
    while ((m = REGULATION_PATTERN.exec(input)) !== null) {
      const provision = m[2];
      const actName = m[3];
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        label: m[0],
        kind: "regulation",
        provision,
        actName,
        slug: null,
        url: null,
        resolved: false
      });
    }
    return matches;
  }

  function findOrderRuleMatches(text) {
    const matches = [];
    const input = String(text || "");
    ORDER_PATTERN.lastIndex = 0;
    let m;
    while ((m = ORDER_PATTERN.exec(input)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        label: m[0],
        kind: "order",
        provision: `${m[1]}r${m[2]}`,
        actName: "Rules of Court",
        slug: null,
        url: null,
        resolved: false
      });
    }
    return matches;
  }

  function findStatuteMatches(text) {
    const all = [
      ...findSectionMatches(text),
      ...findRegulationMatches(text),
      ...findOrderRuleMatches(text)
    ].sort((a, b) => a.start - b.start);

    const filtered = [];
    let cursor = 0;
    for (const match of all) {
      if (match.start < cursor) continue;
      filtered.push(match);
      cursor = match.end;
    }
    return filtered;
  }

  function renderTextWithStatutes(documentRef, text) { // returns DocumentFragment
    const doc = documentRef;
    const fragment = doc.createDocumentFragment();
    const input = String(text || "");
    const matches = findStatuteMatches(input);

    if (!matches.length) {
      fragment.appendChild(doc.createTextNode(input));
      return fragment;
    }

    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor) {
        fragment.appendChild(doc.createTextNode(input.slice(cursor, match.start)));
      }
      if (match.resolved && match.url) {
        const anchor = doc.createElement("a");
        anchor.className = "jm-statute-link jm-statute-resolved";
        anchor.textContent = match.label;
        anchor.setAttribute("href", match.url);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.setAttribute("title", `SSO: ${match.actName}`);
        fragment.appendChild(anchor);
      } else {
        const span = doc.createElement("span");
        span.className = "jm-statute-link jm-statute-unresolved";
        span.textContent = match.label;
        span.setAttribute("title", `Unresolved act: ${match.actName}`);
        fragment.appendChild(span);
      }
      cursor = match.end;
    }
    if (cursor < input.length) {
      fragment.appendChild(doc.createTextNode(input.slice(cursor)));
    }
    return fragment;
  }

  return {
    ACT_TO_SLUG,
    buildSsoUrl,
    findStatuteMatches,
    lookupActSlug,
    normaliseActName,
    renderTextWithStatutes
  };
});
