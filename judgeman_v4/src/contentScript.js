(() => {
  const loggerApi = globalThis.JudgemanLogger;
  const logger = loggerApi?.createLogger
    ? loggerApi.createLogger({ namespace: "ContentScript" })
    : {
        info: console.log.bind(console, "[ContentScript]"),
        error: console.error.bind(console, "[ContentScript]"),
        warn: console.warn.bind(console, "[ContentScript]")
      };

  const browserApi = globalThis.browserApi || globalThis.browser || globalThis.chrome;
  const extractorApi = globalThis.JudgemanExtractor;
  const contentApp = globalThis.JudgemanContentApp;
  const caseToolkit = globalThis.JudgemanCaseToolkit;

  const missing = [];
  if (!browserApi) missing.push("browserApi");
  if (!extractorApi) missing.push("JudgemanExtractor");
  if (!contentApp) missing.push("JudgemanContentApp");

  if (missing.length > 0) {
    logger.error("content_script_dependency_missing", new Error("Missing content dependencies."), {
      missing
    });
    return;
  }

  try {
    const app = contentApp.createContentApp({
      window: globalThis,
      document: globalThis.document,
      browserApi,
      extractorApi,
      caseToolkit,
      loggerApi
    });

    app.start();
    logger.info("content_script_started", {
      href: globalThis.location?.href || ""
    });
  } catch (error) {
    logger.error("content_script_start_failed", error);
  }
})();
