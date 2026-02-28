const CONTENT_SCRIPT_MARKER = "data-legal-tech-extension";

if (!document.documentElement.hasAttribute(CONTENT_SCRIPT_MARKER)) {
  document.documentElement.setAttribute(CONTENT_SCRIPT_MARKER, "active");

  chrome.runtime.sendMessage({ type: "extension.ping" }).catch(() => undefined);
}
