(function (root, factory) {
  const api = factory(root);
  root.JudgemanAnnotations = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  const MAX_TEXT = 8000;
  async function request(action, caseKey, extra = {}) {
    const api = root.browserApi || root.browser || root.chrome;
    if (!api?.runtime?.sendMessage) throw new Error("Private extension storage is unavailable.");
    let timeout;
    try {
      const response = await Promise.race([
        api.runtime.sendMessage({type:"JUDGEMAN_ANNOTATIONS", action, caseKey, ...extra}),
        new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error("Annotation request timed out; check saved notes before retrying.")), 5000);})
      ]);
      if (!response?.ok) throw new Error(response?.error || "Private annotation storage is unavailable.");
      return response.data;
    } finally {clearTimeout(timeout);}
  }
  const load = caseKey => request("load", caseKey);
  const save = (caseKey, annotations) => request("save", caseKey, {annotations});
  const add = (caseKey, text, paragraphRef) => request("add", caseKey, {text, paragraphRef});
  const remove = (caseKey, id) => request("remove", caseKey, {id});
  const clear = caseKey => request("clear", caseKey);
  async function exportBundle(caseKey, caseData) {
    return {exportedAt:new Date().toISOString(), caseNumber:caseData?.caseNumber || caseKey,
      caseTitle:caseData?.caseTitle || "", caseKey, annotations:await load(caseKey)};
  }
  const exportAllBundles = () => request("exportAll");
  return {load, save, add, remove, clear, exportBundle, exportAllBundles, MAX_TEXT};
});
