chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "extension.ping") {
    sendResponse({
      ok: true,
      source: "background"
    });
    return true;
  }

  return false;
});
