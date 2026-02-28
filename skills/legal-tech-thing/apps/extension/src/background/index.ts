import type { ContractDetectionResult } from "../content/contract-detector";
import { CONTRACT_DETECTION_MESSAGE_TYPE } from "../content/contract-detector";
import type { DomExtractionResult } from "../content/dom-extractor";
import { DOM_EXTRACTION_MESSAGE_TYPE } from "../content/dom-extractor";

const detectionByTabId = new Map<number, ContractDetectionResult>();
const extractionByTabId = new Map<number, DomExtractionResult>();

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

  if (message?.type === DOM_EXTRACTION_MESSAGE_TYPE) {
    const senderTabId = _sender.tab?.id;
    const extractionPayload = message?.payload as DomExtractionResult | undefined;

    if (senderTabId !== undefined && extractionPayload) {
      extractionByTabId.set(senderTabId, extractionPayload);
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
      detection: senderTabId !== undefined ? detectionByTabId.get(senderTabId) ?? null : null,
      extraction: senderTabId !== undefined ? extractionByTabId.get(senderTabId) ?? null : null
    });
    return true;
  }

  return false;
});
