const apiUrlInput = document.getElementById("apiUrl");
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const findingsNode = document.getElementById("findings");
const summaryNode = document.getElementById("summary");

async function getStoredApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["orderStampApiUrl"], (result) => {
      resolve(result.orderStampApiUrl || "http://127.0.0.1:4012");
    });
  });
}

async function setStoredApiUrl(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ orderStampApiUrl: value }, () => resolve());
  });
}

async function extractActiveTabText() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "ORDER_STAMP_SCAN_ACTIVE_TAB" }, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.error || "SCAN_FAILED"));
        return;
      }

      resolve(response.payload);
    });
  });
}

async function highlightMatchedText(matchedText) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        resolve(false);
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "ORDER_STAMP_HIGHLIGHT", matchedText }, () => {
        resolve(true);
      });
    });
  });
}

async function clearHighlights() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        resolve(false);
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "ORDER_STAMP_CLEAR_HIGHLIGHTS" }, () => {
        resolve(true);
      });
    });
  });
}

function renderReport(report) {
  summaryNode.textContent = `Risk ${report.riskScore}/100 (${report.verdict}) - ${report.findings.length} finding(s)`;
  findingsNode.innerHTML = "";

  for (const finding of report.findings) {
    const li = document.createElement("li");
    li.className = `finding-${finding.severity}`;

    const title = document.createElement("strong");
    title.textContent = `${finding.title} [${finding.severity}]`;

    const detail = document.createElement("p");
    detail.textContent = finding.context;

    const button = document.createElement("button");
    button.textContent = "Highlight match";
    button.addEventListener("click", () => {
      highlightMatchedText(finding.matchedText).catch(() => undefined);
    });

    li.appendChild(title);
    li.appendChild(detail);
    li.appendChild(button);
    findingsNode.appendChild(li);
  }
}

scanBtn.addEventListener("click", async () => {
  try {
    scanBtn.disabled = true;
    findingsNode.innerHTML = "";
    summaryNode.textContent = "Scanning...";

    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, "");
    await setStoredApiUrl(apiUrl);

    const extraction = await extractActiveTabText();
    const response = await fetch(`${apiUrl}/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: extraction.text, url: extraction.url, maxFindings: 20 })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(payload));
    }

    renderReport(payload.report);
  } catch (error) {
    summaryNode.textContent = String(error);
  } finally {
    scanBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  clearHighlights().catch(() => undefined);
});

getStoredApiUrl().then((apiUrl) => {
  apiUrlInput.value = apiUrl;
});
