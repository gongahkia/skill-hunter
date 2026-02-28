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
const badgeStateByTabId = new Map<number, "idle" | "scanning" | "issues" | "clear">();

function clearTabData(tabId: number) {
  detectionByTabId.delete(tabId);
  extractionByTabId.delete(tabId);
  termsLinksByTabId.delete(tabId);
  preAcceptInterceptByTabId.delete(tabId);
}

function getBadgeText(state: "idle" | "scanning" | "issues" | "clear") {
  switch (state) {
    case "scanning":
      return "SCAN";
    case "issues":
      return "RISK";
    case "clear":
      return "OK";
    case "idle":
    default:
      return "IDLE";
  }
}

function getBadgeColor(state: "idle" | "scanning" | "issues" | "clear") {
  switch (state) {
    case "scanning":
      return "#1d4ed8";
    case "issues":
      return "#b91c1c";
    case "clear":
      return "#166534";
    case "idle":
    default:
      return "#475569";
  }
}

function deriveTabBadgeState(tabId: number) {
  const currentState = badgeStateByTabId.get(tabId);
  const detection = detectionByTabId.get(tabId);
  const extraction = extractionByTabId.get(tabId);
  const termsLinks = termsLinksByTabId.get(tabId);
  const preAcceptIntercept = preAcceptInterceptByTabId.get(tabId);

  if (currentState === "scanning" && !detection && !extraction) {
    return "scanning" as const;
  }

  if (!detection && !extraction && !termsLinks && !preAcceptIntercept) {
    return "idle" as const;
  }

  const missingTermsLinkForContract =
    detection?.isContractLike === true && (termsLinks?.links.length ?? 0) === 0;
  const hasInterceptedAcceptAction = preAcceptIntercept !== undefined;

  return missingTermsLinkForContract || hasInterceptedAcceptAction ? ("issues" as const) : ("clear" as const);
}

function applyBadgeState(tabId: number, state: "idle" | "scanning" | "issues" | "clear") {
  badgeStateByTabId.set(tabId, state);
  void chrome.action.setBadgeText({
    tabId,
    text: getBadgeText(state)
  });
  void chrome.action.setBadgeBackgroundColor({
    tabId,
    color: getBadgeColor(state)
  });
  void chrome.action.setBadgeTextColor({
    tabId,
    color: "#ffffff"
  });
}

function refreshTabBadgeState(tabId: number) {
  applyBadgeState(tabId, deriveTabBadgeState(tabId));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  void chrome.action.setBadgeText({ text: "IDLE" });
  void chrome.action.setBadgeBackgroundColor({ color: getBadgeColor("idle") });
  void chrome.action.setBadgeTextColor({ color: "#ffffff" });
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.action.setBadgeText({ text: "IDLE" });
  void chrome.action.setBadgeBackgroundColor({ color: getBadgeColor("idle") });
  void chrome.action.setBadgeTextColor({ color: "#ffffff" });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearTabData(tabId);
    applyBadgeState(tabId, "scanning");
    return;
  }

  if (changeInfo.status === "complete") {
    refreshTabBadgeState(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabData(tabId);
  badgeStateByTabId.delete(tabId);
});

function getTabScanState(tabId: number | null) {
  if (tabId === null) {
    return {
      tabId,
      badgeState: "idle",
      detection: null,
      extraction: null,
      termsLinks: null,
      preAcceptIntercept: null
    };
  }

  return {
    tabId,
    badgeState: badgeStateByTabId.get(tabId) ?? "idle",
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
      refreshTabBadgeState(senderTabId);
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
      refreshTabBadgeState(senderTabId);
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
      refreshTabBadgeState(senderTabId);
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
      refreshTabBadgeState(senderTabId);
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
