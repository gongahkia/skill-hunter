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

if (!document.documentElement.hasAttribute(CONTENT_SCRIPT_MARKER)) {
  document.documentElement.setAttribute(CONTENT_SCRIPT_MARKER, "active");

  const detectionResult = detectContractLikePage(document, window.location.href);
  const extractionResult = extractVisibleContractText(document, window.location.href);
  const termsLinksResult = extractTermsLinksNearConsentControls(document, window.location.href);

  document.documentElement.setAttribute(PAGE_DETECTION_MARKER, String(detectionResult.isContractLike));
  document.documentElement.setAttribute(
    EXTRACTION_CHARS_MARKER,
    String(extractionResult.extractedCharacters)
  );
  document.documentElement.setAttribute(TERMS_LINKS_MARKER, String(termsLinksResult.links.length));
  document.documentElement.setAttribute(PRE_ACCEPT_MARKER, "active");

  chrome.runtime
    .sendMessage({ type: CONTRACT_DETECTION_MESSAGE_TYPE, payload: detectionResult })
    .catch(() => undefined);
  chrome.runtime
    .sendMessage({ type: DOM_EXTRACTION_MESSAGE_TYPE, payload: extractionResult })
    .catch(() => undefined);
  chrome.runtime
    .sendMessage({ type: TERMS_LINK_EXTRACTION_MESSAGE_TYPE, payload: termsLinksResult })
    .catch(() => undefined);

  installPreAcceptInterceptor(document, window.location.href);

  chrome.runtime.sendMessage({ type: "extension.ping" }).catch(() => undefined);
}
