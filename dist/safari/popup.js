const browserApi = globalThis.browserApi || globalThis.browser || globalThis.chrome;
const caseToolkit = globalThis.JudgemanCaseToolkit;
const loggerApi = globalThis.JudgemanLogger;
const logger = loggerApi?.createLogger
  ? loggerApi.createLogger({ namespace: "Popup" })
  : {
      info: console.log.bind(console, "[Popup]"),
      warn: console.warn.bind(console, "[Popup]"),
      error: console.error.bind(console, "[Popup]"),
      exportText(extra = {}) {
        return JSON.stringify({ extra }, null, 2);
      }
    };

const $ = (selector) => document.querySelector(selector);

let lastCaseData = null;

function describeError(error) {
  return String(error?.message || error || "Unknown error");
}

function setStatus(text, tone = "info") {
  const statusEl = $("#status");
  if (!statusEl) return;

  statusEl.textContent = text || "";
  statusEl.classList.remove("status-error", "status-warn", "status-success");

  if (tone === "error") {
    statusEl.classList.add("status-error");
  } else if (tone === "warn") {
    statusEl.classList.add("status-warn");
  } else if (tone === "success") {
    statusEl.classList.add("status-success");
  }
}

function setCaseTitle(text) {
  const titleEl = $("#caseTitle");
  if (titleEl) {
    titleEl.textContent = text || "ELIT judgment helper";
  }
}

function ensureCaseAnalysis(caseData) {
  if (!caseData) return null;
  if (caseData.caseAnalysis) return caseData.caseAnalysis;

  if (caseToolkit?.analyseCase) {
    caseData.caseAnalysis = caseToolkit.analyseCase(caseData);
    return caseData.caseAnalysis;
  }

  return null;
}

function updateSignals(caseData) {
  const analysis = ensureCaseAnalysis(caseData) || {};
  const warnings = analysis.dataQualityWarnings || [];

  const outcomeSignal = $("#outcomeSignal");
  const readTimeSignal = $("#readTimeSignal");
  const warningSignal = $("#warningSignal");

  if (outcomeSignal) {
    outcomeSignal.textContent = analysis?.brief?.outcome || "Outcome undetected";
  }

  if (readTimeSignal) {
    readTimeSignal.textContent = `${analysis?.metrics?.estimatedReadMinutes || 0} min read`;
  }

  if (warningSignal) {
    warningSignal.textContent = `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;
    warningSignal.classList.toggle("pill-warn", warnings.length > 0);
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(text || ""));
    return;
  }

  const fallbackInput = document.createElement("textarea");
  fallbackInput.value = String(text || "");
  fallbackInput.setAttribute("readonly", "readonly");
  fallbackInput.style.position = "fixed";
  fallbackInput.style.opacity = "0";
  document.body.appendChild(fallbackInput);
  fallbackInput.select();

  const copied = document.execCommand?.("copy");
  fallbackInput.remove();

  if (!copied) {
    throw new Error("Clipboard is unavailable in this browser context.");
  }
}

async function getActiveTab() {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  return await browserApi.tabs.sendMessage(tab.id, message);
}

async function refreshCaseData() {
  setStatus("Scanning page...");
  logger.info("refresh_case_data_started");

  const response = await sendToActiveTab({ type: "REFRESH_CASE_DATA" });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to refresh case data.");
  }

  lastCaseData = response.data;
  ensureCaseAnalysis(lastCaseData);

  setCaseTitle(lastCaseData?.caseTitle || "ELIT judgment helper");
  updateSignals(lastCaseData);

  if ((lastCaseData?.extractionErrors || []).length > 0) {
    setStatus("Ready with extraction warnings.", "warn");
  } else {
    setStatus(lastCaseData?.isJudgment ? "Ready." : "Ready (non-judgment page).", "success");
  }

  logger.info("refresh_case_data_completed", {
    isJudgment: lastCaseData?.isJudgment || false,
    extractionWarnings: lastCaseData?.extractionErrors?.length || 0
  });

  return response;
}

async function ensureCaseData() {
  if (lastCaseData) return lastCaseData;
  const response = await sendToActiveTab({ type: "PING" });
  if (!response?.ok) {
    throw new Error(response?.error || "Judgeman is not active on this page.");
  }

  lastCaseData = response.data;
  ensureCaseAnalysis(lastCaseData);
  setCaseTitle(lastCaseData?.caseTitle || "ELIT judgment helper");
  updateSignals(lastCaseData);

  return lastCaseData;
}

async function copyCaseJson() {
  const caseData = await ensureCaseData();
  await copyToClipboard(JSON.stringify(caseData, null, 2));
  logger.info("copy_case_json_completed", { caseTitle: caseData?.caseTitle || "" });
}

async function copyCaseBrief() {
  const caseData = await ensureCaseData();
  if (!caseToolkit?.buildMarkdownBrief) {
    throw new Error("Case brief toolkit is unavailable.");
  }
  const markdown = caseToolkit.buildMarkdownBrief(caseData);
  await copyToClipboard(markdown);
  logger.info("copy_case_brief_completed", { caseTitle: caseData?.caseTitle || "" });
}

async function copyDiagnostics() {
  const caseData = await ensureCaseData();
  let diagnostics = "";

  const response = await sendToActiveTab({ type: "GET_DIAGNOSTICS" }).catch(() => null);
  if (response?.ok && response?.data) {
    diagnostics = response.data;
  } else {
    diagnostics = logger.exportText({
      fallback: true,
      caseTitle: caseData?.caseTitle || "",
      extractionErrors: caseData?.extractionErrors || []
    });
  }

  await copyToClipboard(diagnostics);
  logger.info("copy_diagnostics_completed");
}

async function runAction(actionName, operation, successText, options = {}) {
  try {
    await operation();
    if (successText) {
      setStatus(successText, options.tone || "success");
    }
  } catch (error) {
    logger.error(`${actionName}_failed`, error);
    setStatus(`Error: ${describeError(error)}`, "error");
  }
}

function registerGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    logger.error("popup_window_error", event?.error || event?.message || "Unknown error", {
      filename: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.error("popup_window_unhandled_rejection", event?.reason || "Unknown rejection");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = $("#toggleBtn");
  const refreshBtn = $("#refreshBtn");
  const copyCaseBtn = $("#copyCaseBtn");
  const copyBriefBtn = $("#copyBriefBtn");
  const copyDiagnosticsBtn = $("#copyDiagnosticsBtn");

  registerGlobalErrorHandlers();
  setStatus("Ready.");

  toggleBtn?.addEventListener("click", async () => {
    await runAction(
      "toggle_reader",
      async () => {
        setStatus("Toggling view...");
        const response = await sendToActiveTab({ type: "TOGGLE_SIMPLIFIED" });
        if (!response?.ok) {
          throw new Error(response?.error || "Toggle failed.");
        }
        setStatus(response.simplified ? "Readable view enabled." : "Readable view disabled.", "success");
        window.close();
      },
      "",
      { tone: "success" }
    );
  });

  refreshBtn?.addEventListener("click", async () => {
    await runAction("refresh", refreshCaseData, "Case data refreshed.");
  });

  copyCaseBtn?.addEventListener("click", async () => {
    await runAction("copy_case_json", copyCaseJson, "Case JSON copied.");
  });

  copyBriefBtn?.addEventListener("click", async () => {
    await runAction("copy_case_brief", copyCaseBrief, "Case brief copied.");
  });

  copyDiagnosticsBtn?.addEventListener("click", async () => {
    await runAction("copy_diagnostics", copyDiagnostics, "Diagnostics copied.");
  });

  void refreshCaseData().catch((error) => {
    logger.error("initial_refresh_failed", error);
    setStatus(`Error: ${describeError(error)}`, "error");
  });
});
