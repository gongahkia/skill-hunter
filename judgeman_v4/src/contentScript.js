(() => {
  const browserApi = globalThis.browserApi || globalThis.browser || globalThis.chrome;
  const extractorApi = globalThis.JudgemanExtractor;
  const contentApp = globalThis.JudgemanContentApp;

  if (!browserApi || !extractorApi || !contentApp) {
    return;
  }

  const app = contentApp.createContentApp({
    window: globalThis,
    document: globalThis.document,
    browserApi,
    extractorApi
  });

  app.start();
})();
