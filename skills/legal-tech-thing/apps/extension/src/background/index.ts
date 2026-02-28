import type { ContractDetectionResult } from "../content/contract-detector";
import { CONTRACT_DETECTION_MESSAGE_TYPE } from "../content/contract-detector";

const detectionByTabId = new Map<number, ContractDetectionResult>();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === CONTRACT_DETECTION_MESSAGE_TYPE) {
    const senderTabId = _sender.tab?.id;
    const detectionPayload = message?.payload as ContractDetectionResult | undefined;

    if (senderTabId !== undefined && detectionPayload) {
      detectionByTabId.set(senderTabId, detectionPayload);
    }

    sendResponse({
      ok: true,
      source: "background",
      tabId: senderTabId ?? null
    });
    return true;
  }

  if (message?.type === "extension.ping") {
    const senderTabId = _sender.tab?.id;
    sendResponse({
      ok: true,
      source: "background",
      detection: senderTabId !== undefined ? detectionByTabId.get(senderTabId) ?? null : null
    });
    return true;
  }

  return false;
});
