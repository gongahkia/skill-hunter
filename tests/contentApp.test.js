const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const extractorApi = require("../judgeman_v4/src/extractor.js");
const { createContentApp } = require("../judgeman_v4/src/contentApp.js");

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function createBrowserApiStub() {
  return {
    runtime: {
      onMessage: {
        addListener() {}
      }
    }
  };
}

test("reader overlay preserves the original ELIT DOM while toggling", async () => {
  const dom = new JSDOM(loadFixture("elit-judgment.html"), {
    pretendToBeVisual: true,
    url: "https://www.elitigation.sg/gd/s/2024_SGHC_101"
  });

  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {}
    }
  });

  const originalBodyHtml = dom.window.document.body.innerHTML;
  const app = createContentApp({
    window: dom.window,
    document: dom.window.document,
    browserApi: createBrowserApiStub(),
    extractorApi
  });

  app.start();
  await app.showReadableView();

  const readerRoot = dom.window.document.getElementById("judgeman-reader-root");
  assert.ok(readerRoot);
  assert.equal(readerRoot.classList.contains("jm-reader-visible"), true);
  assert.match(dom.window.document.body.innerHTML, /Public Prosecutor v Tan Example/);
  assert.match(readerRoot.textContent, /Case brief \(student mode\)/);
  assert.match(readerRoot.textContent, /Authorities and statutory references/);
  assert.equal(
    dom.window.document.querySelector(".caseTitle")?.textContent?.trim(),
    "Public Prosecutor v Tan Example [2024] SGHC 101"
  );
  assert.equal(dom.window.document.body.innerHTML, originalBodyHtml);

  app.hideReadableView();

  assert.equal(readerRoot.classList.contains("jm-reader-visible"), false);
  assert.equal(dom.window.document.body.innerHTML, originalBodyHtml);
  assert.ok(dom.window.document.querySelector("#info-table"));
});
