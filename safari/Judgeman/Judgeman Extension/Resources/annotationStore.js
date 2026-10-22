(function (root, factory) {
  const api = factory();
  root.JudgemanAnnotationStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  const PREFIX = "judgeman.annotations.v2.";
  const MAX_TEXT = 8000;
  const MAX_NOTES = 500;
  function validNote(note) {
    return note && typeof note === "object" &&
      typeof note.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(note.id) &&
      typeof note.text === "string" && !!note.text.trim() && note.text.length <= MAX_TEXT &&
      (note.paragraphRef === null || typeof note.paragraphRef === "string" && note.paragraphRef.length <= 200) &&
      typeof note.createdAt === "string" && Number.isFinite(Date.parse(note.createdAt));
  }
  function validNotes(notes) {
    return Array.isArray(notes) && notes.length <= MAX_NOTES && notes.every(validNote) &&
      new Set(notes.map(note => note.id)).size === notes.length;
  }
  function storageKey(caseKey) {
    if (typeof caseKey !== "string" || !caseKey.trim() || caseKey.length > 2000) {
      throw new Error("A valid case identity is required to save annotations.");
    }
    return PREFIX + encodeURIComponent(caseKey);
  }
  function createStore(storage) {
    let pending = Promise.resolve();
    async function read(caseKey) {
      const key = storageKey(caseKey);
      const value = (await storage.get(key))[key];
      if (value === undefined) return [];
      if (!value || value.schemaVersion !== 2 || value.caseKey !== caseKey || !validNotes(value.annotations)) {
        throw new Error("Stored annotations are invalid. Existing data was retained for recovery.");
      }
      return value.annotations;
    }
    async function write(caseKey, notes) {
      if (!validNotes(notes)) throw new Error("Annotations exceed their limits or contain invalid data.");
      await storage.set({[storageKey(caseKey)]:{schemaVersion:2, caseKey, annotations:notes}});
    }
    async function execute(request) {
      const {action, caseKey} = request || {};
      if (action === "exportAll") {
        const values = await storage.get(null);
        const bundles = [];
        for (const [key, value] of Object.entries(values)) {
          if (!key.startsWith(PREFIX)) continue;
          if (!value || storageKey(value.caseKey) !== key) throw new Error("Stored annotation identity is invalid.");
          const notes = await read(value.caseKey);
          if (notes.length) bundles.push({caseKey:value.caseKey, annotations:notes});
        }
        return {exportedAt:new Date().toISOString(), bundles};
      }
      storageKey(caseKey);
      if (action === "clear") { await storage.remove(storageKey(caseKey)); return true; }
      const notes = await read(caseKey);
      if (action === "load") return notes;
      if (action === "save") { await write(caseKey, request.annotations); return true; }
      if (action === "add") {
        const text = typeof request.text === "string" ? request.text.trim() : "";
        if (!text) return null;
        if (text.length > MAX_TEXT) throw new Error(`Notes are limited to ${MAX_TEXT} characters.`);
        if (notes.length >= MAX_NOTES) throw new Error(`A case can contain at most ${MAX_NOTES} annotations.`);
        const note = {id:crypto.randomUUID(), text, paragraphRef:request.paragraphRef ?? null, createdAt:new Date().toISOString()};
        await write(caseKey, [...notes, note]);
        return note;
      }
      if (action === "remove") {
        if (typeof request.id !== "string") throw new Error("A valid annotation ID is required.");
        const next = notes.filter(note => note.id !== request.id);
        await write(caseKey, next); return next;
      }
      throw new Error("Unknown annotation action.");
    }
    function dispatch(request) {
      const operation = pending.then(() => execute(request));
      pending = operation.catch(() => {});
      return operation;
    }
    return {dispatch};
  }
  return {createStore, storageKey, validNotes, PREFIX, MAX_TEXT, MAX_NOTES};
});
