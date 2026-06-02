(function attachCitationAdapters(root, factory) {
  const api = factory();
  root.JudgemanCitationAdapters = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function citationAdaptersFactory() {
  const adapters = {};

  function registerAdapter(jurisdiction, adapter) { // adapter: { id, label, extractCitations(text), extractStatutes(text) }
    adapters[jurisdiction] = adapter;
  }

  function getAdapter(jurisdiction) {
    return adapters[jurisdiction] || null;
  }

  function listJurisdictions() {
    return Object.keys(adapters);
  }

  function extractAll(text, jurisdictions) { // returns { citations: [], statutes: [] } merged from selected adapters
    const keys = Array.isArray(jurisdictions) && jurisdictions.length ? jurisdictions : Object.keys(adapters);
    const citations = [];
    const statutes = [];
    for (const key of keys) {
      const adapter = adapters[key];
      if (!adapter) continue;
      citations.push(...(adapter.extractCitations(text) || []));
      statutes.push(...(adapter.extractStatutes(text) || []));
    }
    return { citations: dedupeStrings(citations), statutes: dedupeStrings(statutes) };
  }

  function dedupeStrings(values) {
    const seen = new Set();
    const out = [];
    for (const v of values) {
      const key = String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(v || "").replace(/\s+/g, " ").trim());
    }
    return out;
  }

  // --- SG adapter (Singapore) ---
  registerAdapter("SG", {
    id: "SG",
    label: "Singapore",
    extractCitations(text) {
      const input = String(text || "");
      const patterns = [
        /\[\d{4}\]\s+SG[A-Z]{1,6}\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+SLR(?:\(R\))?\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+MLJ\s+\d+/g
      ];
      const hits = [];
      for (const p of patterns) { const m = input.match(p); if (m) hits.push(...m); }
      return hits;
    },
    extractStatutes(text) {
      const input = String(text || "");
      const refs = [];
      const sec = input.match(/\b(?:section|sections|s\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?(?:\s+of\s+the\s+[A-Z][A-Za-z0-9 ,.&()\/-]+)?/gi);
      const art = input.match(/\b(?:article|articles|art\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?/gi);
      const ord = input.match(/\b(?:order|rule|part)\s+[A-Za-z0-9().\-]+(?:\s+[A-Za-z0-9().\-]+){0,3}/gi);
      if (sec) refs.push(...sec);
      if (art) refs.push(...art);
      if (ord) refs.push(...ord);
      return refs;
    }
  });

  // --- UK adapter (England & Wales) ---
  registerAdapter("UK", {
    id: "UK",
    label: "England & Wales",
    extractCitations(text) {
      const input = String(text || "");
      const patterns = [
        /\[\d{4}\]\s+UKSC\s+\d+/g,
        /\[\d{4}\]\s+UKHL\s+\d+/g,
        /\[\d{4}\]\s+EWCA\s+(?:Civ|Crim)\s+\d+/g,
        /\[\d{4}\]\s+EWHC\s+\d+\s*\([A-Za-z]+\)/g,
        /\[\d{4}\]\s+\d+\s+AC\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+WLR\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+All\s+ER\s+\d+/g
      ];
      const hits = [];
      for (const p of patterns) { const m = input.match(p); if (m) hits.push(...m); }
      return hits;
    },
    extractStatutes(text) {
      const input = String(text || "");
      const refs = [];
      const sec = input.match(/\b(?:section|sections|s\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?(?:\s+of\s+the\s+[A-Z][A-Za-z0-9 ,.&()\/-]+)?/gi);
      if (sec) refs.push(...sec);
      return refs;
    }
  });

  // --- MY adapter (Malaysia) ---
  registerAdapter("MY", {
    id: "MY",
    label: "Malaysia",
    extractCitations(text) {
      const input = String(text || "");
      const patterns = [
        /\[\d{4}\]\s+\d+\s+MLJ\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+MLJU\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+CLJ\s+\d+/g,
        /\[\d{4}\]\s+MLJU\s+\d+/g,
        /\[\d{4}\]\s+MYFC\s+\d+/g,
        /\[\d{4}\]\s+MYCA\s+\d+/g
      ];
      const hits = [];
      for (const p of patterns) { const m = input.match(p); if (m) hits.push(...m); }
      return hits;
    },
    extractStatutes(text) {
      const input = String(text || "");
      const refs = [];
      const sec = input.match(/\b(?:section|sections|s\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?(?:\s+of\s+the\s+[A-Z][A-Za-z0-9 ,.&()\/-]+)?/gi);
      if (sec) refs.push(...sec);
      return refs;
    }
  });

  // --- AU adapter (Australia) ---
  registerAdapter("AU", {
    id: "AU",
    label: "Australia",
    extractCitations(text) {
      const input = String(text || "");
      const patterns = [
        /\[\d{4}\]\s+HCA\s+\d+/g,
        /\[\d{4}\]\s+FCAFC\s+\d+/g,
        /\[\d{4}\]\s+FCA\s+\d+/g,
        /\[\d{4}\]\s+NSWCA\s+\d+/g,
        /\[\d{4}\]\s+NSWSC\s+\d+/g,
        /\[\d{4}\]\s+VSCA\s+\d+/g,
        /\[\d{4}\]\s+VSC\s+\d+/g,
        /\(\d{4}\)\s+\d+\s+CLR\s+\d+/g,
        /\[\d{4}\]\s+\d+\s+ALR\s+\d+/g
      ];
      const hits = [];
      for (const p of patterns) { const m = input.match(p); if (m) hits.push(...m); }
      return hits;
    },
    extractStatutes(text) {
      const input = String(text || "");
      const refs = [];
      const sec = input.match(/\b(?:section|sections|s\.)\s+\d+[A-Za-z0-9()\-]*(?:\s*(?:to|-)\s*\d+[A-Za-z0-9()\-]*)?(?:\s+of\s+the\s+[A-Z][A-Za-z0-9 ,.&()\/-]+)?/gi);
      if (sec) refs.push(...sec);
      return refs;
    }
  });

  return { registerAdapter, getAdapter, listJurisdictions, extractAll };
});
