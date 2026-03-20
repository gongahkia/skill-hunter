const browserApi = globalThis.browserApi || globalThis.browser || globalThis.chrome;
const $ = (selector) => document.querySelector(selector);

let lastCaseData = null;

function setStatus(text) {
  const statusEl = $("#status");
  if (statusEl) {
    statusEl.textContent = text || "";
  }
}

function setCaseTitle(text) {
  const titleEl = $("#caseTitle");
  if (titleEl) {
    titleEl.textContent = text || "ELIT judgment helper";
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
  setStatus("Scanning page…");
  const response = await sendToActiveTab({ type: "REFRESH_CASE_DATA" });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to refresh case data.");
  }
  lastCaseData = response.data;
  setCaseTitle(lastCaseData?.caseTitle || "ELIT judgment helper");
  setStatus(lastCaseData?.isJudgment ? "Ready." : "Ready (non-judgment page).");
  return response;
}

async function ensureCaseData() {
  if (lastCaseData) return lastCaseData;
  const response = await sendToActiveTab({ type: "PING" });
  if (!response?.ok) {
    throw new Error(response?.error || "Judgeman is not active on this page.");
  }
  lastCaseData = response.data;
  setCaseTitle(lastCaseData?.caseTitle || "ELIT judgment helper");
  return lastCaseData;
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = $("#toggleBtn");
  const refreshBtn = $("#refreshBtn");
  const copyCaseBtn = $("#copyCaseBtn");

  setStatus("Ready.");

  toggleBtn?.addEventListener("click", async () => {
    try {
      setStatus("Toggling view…");
      const response = await sendToActiveTab({ type: "TOGGLE_SIMPLIFIED" });
      if (!response?.ok) {
        throw new Error(response?.error || "Toggle failed.");
      }
      setStatus(response.simplified ? "Readable view enabled." : "Readable view disabled.");
      window.close();
    } catch (error) {
      setStatus(`Error: ${String(error?.message || error)}`);
    }
  });

  refreshBtn?.addEventListener("click", async () => {
    try {
      await refreshCaseData();
    } catch (error) {
      setStatus(`Error: ${String(error?.message || error)}`);
    }
  });

  copyCaseBtn?.addEventListener("click", async () => {
    try {
      const caseData = await ensureCaseData();
      await navigator.clipboard.writeText(JSON.stringify(caseData, null, 2));
      setStatus("Case JSON copied.");
    } catch (error) {
      setStatus(`Error: ${String(error?.message || error)}`);
    }
  });

  void refreshCaseData().catch((error) => {
    setStatus(`Error: ${String(error?.message || error)}`);
  });
});
