const HIGHLIGHT_CLASS = "order-stamp-highlight";

function ensureStyle() {
  if (document.getElementById("order-stamp-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "order-stamp-style";
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background: rgba(250, 204, 21, 0.45);
      border-bottom: 2px solid #f59e0b;
    }
  `;
  document.head.appendChild(style);
}

function clearHighlights() {
  const nodes = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  for (const node of nodes) {
    const parent = node.parentNode;
    if (!parent) {
      continue;
    }
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
  }
}

function highlightFirstOccurrence(needle) {
  clearHighlights();
  if (!needle || needle.length < 3) {
    return false;
  }

  ensureStyle();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const normalizedNeedle = needle.toLowerCase();

  while (true) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }

    const text = node.nodeValue;
    if (!text) {
      continue;
    }

    const start = text.toLowerCase().indexOf(normalizedNeedle);
    if (start < 0) {
      continue;
    }

    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + needle.length);

    const mark = document.createElement("mark");
    mark.className = HIGHLIGHT_CLASS;
    try {
      range.surroundContents(mark);
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ORDER_STAMP_EXTRACT_TEXT") {
    sendResponse({
      url: window.location.href,
      title: document.title,
      text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim()
    });
    return true;
  }

  if (message?.type === "ORDER_STAMP_HIGHLIGHT") {
    const highlighted = highlightFirstOccurrence(message?.matchedText ?? "");
    sendResponse({ ok: true, highlighted });
    return true;
  }

  if (message?.type === "ORDER_STAMP_CLEAR_HIGHLIGHTS") {
    clearHighlights();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
