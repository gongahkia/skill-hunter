(function attachAnnotations(root, factory) {
  const api = factory(root);
  root.JudgemanAnnotations = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function annotationsFactory(root) {
  const STORAGE_PREFIX = "judgeman_annotations_";

  function getStorage() {
    try { return root.localStorage || null; } catch (_e) { return null; }
  }

  function storageKey(caseNumber) {
    return STORAGE_PREFIX + String(caseNumber || "unknown").replace(/[^A-Za-z0-9_\-\/]/g, "_");
  }

  function load(caseNumber) {
    const store = getStorage();
    if (!store) return [];
    try {
      const raw = store.getItem(storageKey(caseNumber));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) { return []; }
  }

  function save(caseNumber, annotations) {
    const store = getStorage();
    if (!store) return false;
    try {
      store.setItem(storageKey(caseNumber), JSON.stringify(annotations || []));
      return true;
    } catch (_e) { return false; }
  }

  function add(caseNumber, text, paragraphRef) {
    const annotations = load(caseNumber);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: String(text || "").trim(),
      paragraphRef: paragraphRef || null,
      createdAt: new Date().toISOString()
    };
    if (!entry.text) return null;
    annotations.push(entry);
    save(caseNumber, annotations);
    return entry;
  }

  function remove(caseNumber, annotationId) {
    const annotations = load(caseNumber);
    const filtered = annotations.filter((a) => a.id !== annotationId);
    save(caseNumber, filtered);
    return filtered;
  }

  function clear(caseNumber) {
    const store = getStorage();
    if (!store) return;
    store.removeItem(storageKey(caseNumber));
  }

  function exportBundle(caseNumber, caseData) {
    const annotations = load(caseNumber);
    return {
      exportedAt: new Date().toISOString(),
      caseNumber: caseNumber || "",
      caseTitle: caseData?.caseTitle || "",
      annotations
    };
  }

  function exportAllBundles() { // exports all annotated cases
    const store = getStorage();
    if (!store) return [];
    const bundles = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      try {
        const raw = store.getItem(key);
        const annotations = JSON.parse(raw);
        if (Array.isArray(annotations) && annotations.length > 0) {
          bundles.push({
            storageKey: key,
            caseNumber: key.slice(STORAGE_PREFIX.length),
            annotations
          });
        }
      } catch (_e) { /* skip corrupt entries */ }
    }
    return { exportedAt: new Date().toISOString(), bundles };
  }

  return { load, save, add, remove, clear, exportBundle, exportAllBundles, STORAGE_PREFIX };
});
