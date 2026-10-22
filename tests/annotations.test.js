const test = require("node:test");
const assert = require("node:assert/strict");

// Explicit mock of native extension storage and background messages for unit tests.
const { createStore } = require("../judgeman_v4/src/annotationStore.js");
const values = {};
const broker = createStore({
  async get(key) { return structuredClone(key === null ? values : {[key]:values[key]}); },
  async set(items) { Object.assign(values, structuredClone(items)); },
  async remove(key) { delete values[key]; }
});
globalThis.browserApi = {runtime:{async sendMessage(request) {
  return {ok:true, data:await broker.dispatch(request)};
}}};

const annotations = require("../judgeman_v4/src/annotations.js");

test("add and load annotations for a case", async () => {
  await annotations.clear("HC/MA 15/2024");
  const entry = await annotations.add("HC/MA 15/2024", "Important paragraph about duty of care.");
  assert.ok(entry);
  assert.ok(entry.id);
  assert.equal(entry.text, "Important paragraph about duty of care.");
  assert.ok(entry.createdAt);
  const loaded = await annotations.load("HC/MA 15/2024");
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].text, "Important paragraph about duty of care.");
});

test("remove deletes a specific annotation", async () => {
  await annotations.clear("TEST/01");
  await annotations.add("TEST/01", "Note A");
  const b = await annotations.add("TEST/01", "Note B");
  assert.equal((await annotations.load("TEST/01")).length, 2);
  await annotations.remove("TEST/01", b.id);
  const remaining = await annotations.load("TEST/01");
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].text, "Note A");
});

test("clear removes all annotations for a case", async () => {
  await annotations.add("TEST/02", "Some note");
  await annotations.clear("TEST/02");
  assert.equal((await annotations.load("TEST/02")).length, 0);
});

test("exportBundle returns structured annotation bundle", async () => {
  await annotations.clear("TEST/03");
  await annotations.add("TEST/03", "Research note");
  const bundle = await annotations.exportBundle("TEST/03", { caseTitle: "Foo v Bar" });
  assert.ok(bundle.exportedAt);
  assert.equal(bundle.caseNumber, "TEST/03");
  assert.equal(bundle.caseTitle, "Foo v Bar");
  assert.equal(bundle.annotations.length, 1);
});

test("add ignores empty text", async () => {
  const result = await annotations.add("TEST/04", "   ");
  assert.equal(result, null);
});

test("exportAllBundles aggregates across cases", async () => {
  await annotations.clear("EXPORT/01");
  await annotations.clear("EXPORT/02");
  await annotations.add("EXPORT/01", "Note 1");
  await annotations.add("EXPORT/02", "Note 2");
  const all = await annotations.exportAllBundles();
  assert.ok(all.exportedAt);
  assert.ok(all.bundles.length >= 2);
});
