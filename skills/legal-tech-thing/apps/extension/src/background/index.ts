import type { ContractDetectionResult } from "../content/contract-detector";
import { CONTRACT_DETECTION_MESSAGE_TYPE } from "../content/contract-detector";
import type { DomExtractionResult } from "../content/dom-extractor";
import { DOM_EXTRACTION_MESSAGE_TYPE } from "../content/dom-extractor";
import type { TermsLinkExtractionResult } from "../content/terms-link-extractor";
import { TERMS_LINK_EXTRACTION_MESSAGE_TYPE } from "../content/terms-link-extractor";
import type { PreAcceptInterceptPayload } from "../content/acceptance-interceptor";
import { PRE_ACCEPT_INTERCEPT_MESSAGE_TYPE } from "../content/acceptance-interceptor";

const GET_ACTIVE_SCAN_STATE_MESSAGE_TYPE = "extension.scanState.getActiveTab.v1";

const detectionByTabId = new Map<number, ContractDetectionResult>();
const extractionByTabId = new Map<number, DomExtractionResult>();
const termsLinksByTabId = new Map<number, TermsLinkExtractionResult>();
const preAcceptInterceptByTabId = new Map<number, PreAcceptInterceptPayload>();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

function getTabScanState(tabId: number | null) {
  if (tabId === null) {
    return {
      tabId,
      detection: null,
      extraction: null,
      termsLinks: null,
      preAcceptIntercept: null
    };
  }

  return {
    tabId,
    detection: detectionByTabId.get(tabId) ?? null,
    extraction: extractionByTabId.get(tabId) ?? null,
    termsLinks: termsLinksByTabId.get(tabId) ?? null,
    preAcceptIntercept: preAcceptInterceptByTabId.get(tabId) ?? null
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === GET_ACTIVE_SCAN_STATE_MESSAGE_TYPE) {
    void chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => {
        const activeTabId = tabs[0]?.id ?? null;
        sendResponse({
          ok: true,
          source: "background",
          scanState: getTabScanState(activeTabId)
        });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          source: "background",
          error: error instanceof Error ? error.message : "FAILED_TO_QUERY_ACTIVE_TAB"
        });
      });

    return true;
  }

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
      ...getTabScanState(senderTabId ?? null)
    });
    return true;
  }

  if (message?.type === TERMS_LINK_EXTRACTION_MESSAGE_TYPE) {
    const senderTabId = _sender.tab?.id;
    const termsLinksPayload = message?.payload as TermsLinkExtractionResult | undefined;

    if (senderTabId !== undefined && termsLinksPayload) {
      termsLinksByTabId.set(senderTabId, termsLinksPayload);
    }

    sendResponse({
      ok: true,
      source: "background",
      tabId: senderTabId ?? null
    });
    return true;
  }

  if (message?.type === PRE_ACCEPT_INTERCEPT_MESSAGE_TYPE) {
    const senderTabId = _sender.tab?.id;
    const interceptPayload = message?.payload as PreAcceptInterceptPayload | undefined;

    if (senderTabId !== undefined && interceptPayload) {
      preAcceptInterceptByTabId.set(senderTabId, interceptPayload);
    }

    sendResponse({
      ok: true,
      source: "background",
      tabId: senderTabId ?? null
    });
    return true;
  }

  return false;
});
