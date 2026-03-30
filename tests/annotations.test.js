const test = require("node:test");
const assert = require("node:assert/strict");

// mock localStorage for Node
const store = {};
globalThis.localStorage = {
  _store: store,
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
  get length() { return Object.keys(store).length; },
  key(i) { return Object.keys(store)[i] ?? null; }
};

const annotations = require("../judgeman_v4/src/annotations.js");

test("add and load annotations for a case", () => {
  annotations.clear("HC/MA 15/2024");
  const entry = annotations.add("HC/MA 15/2024", "Important paragraph about duty of care.");
  assert.ok(entry);
  assert.ok(entry.id);
  assert.equal(entry.text, "Important paragraph about duty of care.");
  assert.ok(entry.createdAt);
  const loaded = annotations.load("HC/MA 15/2024");
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].text, "Important paragraph about duty of care.");
});

test("remove deletes a specific annotation", () => {
  annotations.clear("TEST/01");
  annotations.add("TEST/01", "Note A");
  const b = annotations.add("TEST/01", "Note B");
  assert.equal(annotations.load("TEST/01").length, 2);
  annotations.remove("TEST/01", b.id);
  const remaining = annotations.load("TEST/01");
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].text, "Note A");
});

test("clear removes all annotations for a case", () => {
  annotations.add("TEST/02", "Some note");
  annotations.clear("TEST/02");
  assert.equal(annotations.load("TEST/02").length, 0);
});

test("exportBundle returns structured annotation bundle", () => {
  annotations.clear("TEST/03");
  annotations.add("TEST/03", "Research note");
  const bundle = annotations.exportBundle("TEST/03", { caseTitle: "Foo v Bar" });
  assert.ok(bundle.exportedAt);
  assert.equal(bundle.caseNumber, "TEST/03");
  assert.equal(bundle.caseTitle, "Foo v Bar");
  assert.equal(bundle.annotations.length, 1);
});

test("add ignores empty text", () => {
  const result = annotations.add("TEST/04", "   ");
  assert.equal(result, null);
});

test("exportAllBundles aggregates across cases", () => {
  annotations.clear("EXPORT/01");
  annotations.clear("EXPORT/02");
  annotations.add("EXPORT/01", "Note 1");
  annotations.add("EXPORT/02", "Note 2");
  const all = annotations.exportAllBundles();
  assert.ok(all.exportedAt);
  assert.ok(all.bundles.length >= 2);
});
