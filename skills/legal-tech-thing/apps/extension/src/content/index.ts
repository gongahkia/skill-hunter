import {
  CONTRACT_DETECTION_MESSAGE_TYPE,
  detectContractLikePage
} from "./contract-detector";

const CONTENT_SCRIPT_MARKER = "data-legal-tech-extension";
const PAGE_DETECTION_MARKER = "data-legal-tech-contract-like";

if (!document.documentElement.hasAttribute(CONTENT_SCRIPT_MARKER)) {
  document.documentElement.setAttribute(CONTENT_SCRIPT_MARKER, "active");

  const detectionResult = detectContractLikePage(document, window.location.href);
  document.documentElement.setAttribute(PAGE_DETECTION_MARKER, String(detectionResult.isContractLike));

  chrome.runtime
    .sendMessage({ type: CONTRACT_DETECTION_MESSAGE_TYPE, payload: detectionResult })
    .catch(() => undefined);

  chrome.runtime.sendMessage({ type: "extension.ping" }).catch(() => undefined);
}
