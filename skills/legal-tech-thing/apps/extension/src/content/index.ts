import {
  CONTRACT_DETECTION_MESSAGE_TYPE,
  detectContractLikePage
} from "./contract-detector";
import { DOM_EXTRACTION_MESSAGE_TYPE, extractVisibleContractText } from "./dom-extractor";
import {
  TERMS_LINK_EXTRACTION_MESSAGE_TYPE,
  extractTermsLinksNearConsentControls
} from "./terms-link-extractor";
import { installPreAcceptInterceptor } from "./acceptance-interceptor";

const CONTENT_SCRIPT_MARKER = "data-legal-tech-extension";
const PAGE_DETECTION_MARKER = "data-legal-tech-contract-like";
const EXTRACTION_CHARS_MARKER = "data-legal-tech-extracted-chars";
const TERMS_LINKS_MARKER = "data-legal-tech-terms-links";
const PRE_ACCEPT_MARKER = "data-legal-tech-pre-accept-interceptor";
const LAST_SCAN_URL_MARKER = "data-legal-tech-last-scan-url";
const SPA_URL_CHANGE_EVENT = "legal-tech-extension:url-change";
const RESCAN_DEBOUNCE_MS = 250;

if (!document.documentElement.hasAttribute(CONTENT_SCRIPT_MARKER)) {
  document.documentElement.setAttribute(CONTENT_SCRIPT_MARKER, "active");
  document.documentElement.setAttribute(PRE_ACCEPT_MARKER, "active");

  let rescanTimerId: number | null = null;

  const runScan = () => {
    const pageUrl = window.location.href;
    const detectionResult = detectContractLikePage(document, pageUrl);
    const extractionResult = extractVisibleContractText(document, pageUrl);
    const termsLinksResult = extractTermsLinksNearConsentControls(document, pageUrl);

    document.documentElement.setAttribute(PAGE_DETECTION_MARKER, String(detectionResult.isContractLike));
    document.documentElement.setAttribute(
      EXTRACTION_CHARS_MARKER,
      String(extractionResult.extractedCharacters)
    );
    document.documentElement.setAttribute(TERMS_LINKS_MARKER, String(termsLinksResult.links.length));
    document.documentElement.setAttribute(LAST_SCAN_URL_MARKER, pageUrl);

    chrome.runtime
      .sendMessage({ type: CONTRACT_DETECTION_MESSAGE_TYPE, payload: detectionResult })
      .catch(() => undefined);
    chrome.runtime
      .sendMessage({ type: DOM_EXTRACTION_MESSAGE_TYPE, payload: extractionResult })
      .catch(() => undefined);
    chrome.runtime
      .sendMessage({ type: TERMS_LINK_EXTRACTION_MESSAGE_TYPE, payload: termsLinksResult })
      .catch(() => undefined);
  };

  const scheduleRescan = () => {
    if (rescanTimerId !== null) {
      window.clearTimeout(rescanTimerId);
    }

    rescanTimerId = window.setTimeout(() => {
      runScan();
    }, RESCAN_DEBOUNCE_MS);
  };

  const installSpaUrlObserver = () => {
    let lastKnownUrl = window.location.href;

    const emitUrlChangeIfNeeded = () => {
      const nextUrl = window.location.href;
      if (nextUrl === lastKnownUrl) {
        return;
      }
      lastKnownUrl = nextUrl;
      window.dispatchEvent(new Event(SPA_URL_CHANGE_EVENT));
    };

    const wrapHistoryMethod = (method: "pushState" | "replaceState") => {
      const original = history[method] as typeof history.pushState & {
        __legalTechWrapped?: boolean;
      };
      if (original.__legalTechWrapped) {
        return;
      }

      const wrapped = function (this: History, ...args: Parameters<typeof history.pushState>) {
        const result = original.apply(this, args);
        emitUrlChangeIfNeeded();
        return result;
      } as typeof history.pushState & {
        __legalTechWrapped?: boolean;
      };

      wrapped.__legalTechWrapped = true;
      history[method] = wrapped;
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");

    window.addEventListener(SPA_URL_CHANGE_EVENT, () => {
      scheduleRescan();
    });
    window.addEventListener("popstate", () => {
      emitUrlChangeIfNeeded();
      scheduleRescan();
    });
    window.addEventListener("hashchange", () => {
      emitUrlChangeIfNeeded();
      scheduleRescan();
    });
  };

  runScan();
  installSpaUrlObserver();
  installPreAcceptInterceptor(document, () => window.location.href);

  chrome.runtime.sendMessage({ type: "extension.ping" }).catch(() => undefined);
}
