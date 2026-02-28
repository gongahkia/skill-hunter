chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ORDER_STAMP_SCAN_ACTIVE_TAB") {
    return false;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "ACTIVE_TAB_NOT_FOUND" });
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: "ORDER_STAMP_EXTRACT_TEXT" }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true, payload: response });
    });
  });

  return true;
});
