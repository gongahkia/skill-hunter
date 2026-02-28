export const PRE_ACCEPT_INTERCEPT_MESSAGE_TYPE = "extension.preAcceptClick.v1";

const ACCEPTANCE_TEXT_PATTERN =
  /\b(?:accept|agree|continue|submit|confirm|register|sign up|checkout|place order|start trial)\b/i;
const CONSENT_CHECKBOX_PATTERN =
  /\b(?:i agree|i accept|consent|terms|privacy|conditions|policy|legal|authorization)\b/i;
const OVERRIDE_ATTRIBUTE = "data-legal-tech-accept-override";
const WARNING_MODAL_STYLE_ID = "legal-tech-warning-modal-style";
const WARNING_MODAL_OVERLAY_ID = "legal-tech-warning-modal-overlay";

export interface PreAcceptInterceptPayload {
  url: string;
  title: string;
  interceptedAt: string;
  eventType: "click" | "submit";
  controlType: "checkbox" | "button" | "link";
  controlLabel: string;
  controlPath: number[];
  href: string | null;
  formAction: string | null;
  isTrusted: boolean;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function toNodePath(node: Node, root: Node) {
  const path: number[] = [];
  let cursor: Node | null = node;

  while (cursor && cursor !== root) {
    const parentNode: Node | null = cursor.parentNode;
    if (!parentNode) {
      return [];
    }
    const index = Array.prototype.indexOf.call(parentNode.childNodes, cursor) as number;
    if (index < 0) {
      return [];
    }
    path.unshift(index);
    cursor = parentNode;
  }

  return cursor === root ? path : [];
}

function getCheckboxLabel(checkbox: HTMLInputElement) {
  const labels = Array.from(checkbox.labels ?? [])
    .map((label) => normalizeText(label.innerText || label.textContent || ""))
    .filter(Boolean)
    .join(" ");
  const parentText = normalizeText(
    checkbox.closest("label, form, div, section, article")?.textContent ?? ""
  );

  return normalizeText([checkbox.getAttribute("aria-label") ?? "", labels, parentText].join(" "));
}

function getElementLabel(element: Element) {
  const aria = element.getAttribute("aria-label") ?? "";
  const value = element instanceof HTMLInputElement ? element.value : "";
  const text = normalizeText((element as HTMLElement).innerText ?? element.textContent ?? "");
  return normalizeText([aria, value, text].join(" "));
}

function resolveControlLabel(control: Element) {
  return control instanceof HTMLInputElement && control.type === "checkbox"
    ? getCheckboxLabel(control)
    : getElementLabel(control);
}

function isLikelyAcceptanceControl(element: Element) {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    const label = getCheckboxLabel(element);
    return CONSENT_CHECKBOX_PATTERN.test(label);
  }

  const label = getElementLabel(element);
  return ACCEPTANCE_TEXT_PATTERN.test(label);
}

function resolveControlType(element: Element): PreAcceptInterceptPayload["controlType"] {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    return "checkbox";
  }
  if (element instanceof HTMLAnchorElement) {
    return "link";
  }
  return "button";
}

function resolveHref(element: Element) {
  if (element instanceof HTMLAnchorElement) {
    return element.href || null;
  }
  return null;
}

function resolveFormAction(element: Element) {
  const form = element.closest("form");
  return form?.action ?? null;
}

function findLikelyAcceptanceControl(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const candidate = target.closest(
    'input[type="checkbox"], button, input[type="submit"], input[type="button"], a, [role="button"]'
  );
  if (!candidate) {
    return null;
  }
  if (!isLikelyAcceptanceControl(candidate)) {
    return null;
  }

  return candidate;
}

function ensureWarningModalStyles(doc: Document) {
  if (doc.getElementById(WARNING_MODAL_STYLE_ID)) {
    return;
  }

  const styleElement = doc.createElement("style");
  styleElement.id = WARNING_MODAL_STYLE_ID;
  styleElement.textContent = `
    #${WARNING_MODAL_OVERLAY_ID} {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.58);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .legal-tech-warning-modal {
      width: min(460px, 100%);
      background: #ffffff;
      border-radius: 0.65rem;
      border: 1px solid #fca5a5;
      box-shadow: 0 16px 42px rgba(15, 23, 42, 0.28);
      color: #0f172a;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      padding: 1rem;
      display: grid;
      gap: 0.65rem;
    }

    .legal-tech-warning-modal h2 {
      margin: 0;
      font-size: 1rem;
      color: #991b1b;
    }

    .legal-tech-warning-modal p {
      margin: 0;
      line-height: 1.45;
      font-size: 0.9rem;
    }

    .legal-tech-warning-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.55rem;
      margin-top: 0.2rem;
    }

    .legal-tech-warning-modal button {
      border: 0;
      border-radius: 0.35rem;
      font: inherit;
      padding: 0.5rem 0.7rem;
      cursor: pointer;
    }

    .legal-tech-warning-cancel {
      background: #e2e8f0;
      color: #0f172a;
    }

    .legal-tech-warning-proceed {
      background: #dc2626;
      color: #ffffff;
    }
  `;

  (doc.head ?? doc.documentElement).appendChild(styleElement);
}

export function installPreAcceptInterceptor(doc: Document, getCurrentUrl: () => string) {
  const root = doc.body ?? doc.documentElement;
  let lastInterceptSignature = "";
  let lastInterceptAtMs = 0;
  let activeModalPromise: Promise<boolean> | null = null;

  const sendIntercept = (eventType: "click" | "submit", control: Element, isTrusted: boolean) => {
    const controlPath = toNodePath(control, root);
    if (controlPath.length === 0) {
      return;
    }

    const controlLabel = resolveControlLabel(control);

    const signature = `${eventType}:${control.tagName}:${controlLabel}:${controlPath.join(".")}`;
    const now = Date.now();
    if (signature === lastInterceptSignature && now - lastInterceptAtMs <= 300) {
      return;
    }
    lastInterceptSignature = signature;
    lastInterceptAtMs = now;

    const payload: PreAcceptInterceptPayload = {
      url: getCurrentUrl(),
      title: doc.title ?? "",
      interceptedAt: new Date().toISOString(),
      eventType,
      controlType: resolveControlType(control),
      controlLabel,
      controlPath,
      href: resolveHref(control),
      formAction: resolveFormAction(control),
      isTrusted
    };

    chrome.runtime
      .sendMessage({
        type: PRE_ACCEPT_INTERCEPT_MESSAGE_TYPE,
        payload
      })
      .catch(() => undefined);
  };

  const showWarningModal = (controlLabel: string) => {
    if (activeModalPromise) {
      return activeModalPromise;
    }

    ensureWarningModalStyles(doc);

    activeModalPromise = new Promise<boolean>((resolve) => {
      const overlay = doc.createElement("div");
      overlay.id = WARNING_MODAL_OVERLAY_ID;

      const modal = doc.createElement("section");
      modal.className = "legal-tech-warning-modal";
      modal.setAttribute("role", "alertdialog");
      modal.setAttribute("aria-modal", "true");

      const title = doc.createElement("h2");
      title.textContent = "Confirm before accepting";

      const body = doc.createElement("p");
      body.textContent =
        "This action looks like an acceptance control and may bind you to legal terms.";

      const controlRow = doc.createElement("p");
      controlRow.textContent = `Control: ${controlLabel || "Unknown control"}`;

      const actions = doc.createElement("div");
      actions.className = "legal-tech-warning-modal-actions";

      const cancelButton = doc.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "legal-tech-warning-cancel";
      cancelButton.textContent = "Cancel";

      const proceedButton = doc.createElement("button");
      proceedButton.type = "button";
      proceedButton.className = "legal-tech-warning-proceed";
      proceedButton.textContent = "Proceed anyway";

      const cleanup = (allowed: boolean) => {
        doc.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        activeModalPromise = null;
        resolve(allowed);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(false);
        }
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          cleanup(false);
        }
      });
      cancelButton.addEventListener("click", () => cleanup(false));
      proceedButton.addEventListener("click", () => cleanup(true));

      actions.append(cancelButton, proceedButton);
      modal.append(title, body, controlRow, actions);
      overlay.appendChild(modal);
      doc.addEventListener("keydown", onKeyDown, true);
      (doc.body ?? doc.documentElement).appendChild(overlay);
      proceedButton.focus();
    });

    return activeModalPromise;
  };

  const replayControlClick = (control: Element) => {
    if (!(control instanceof HTMLElement)) {
      return;
    }

    if (!control.isConnected) {
      return;
    }

    control.setAttribute(OVERRIDE_ATTRIBUTE, "true");
    control.click();
  };

  doc.addEventListener(
    "click",
    (event) => {
      const control = findLikelyAcceptanceControl(event.target);
      if (!control) {
        return;
      }

      if (control.getAttribute(OVERRIDE_ATTRIBUTE) === "true") {
        control.removeAttribute(OVERRIDE_ATTRIBUTE);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      sendIntercept("click", control, event.isTrusted);

      const controlLabel = resolveControlLabel(control);
      void showWarningModal(controlLabel).then((allowed) => {
        if (!allowed) {
          return;
        }
        replayControlClick(control);
      });
    },
    true
  );

  doc.addEventListener(
    "submit",
    (event) => {
      const submitEvent = event as SubmitEvent;
      const control = submitEvent.submitter ?? findLikelyAcceptanceControl(event.target);
      if (!control) {
        return;
      }
      if (!isLikelyAcceptanceControl(control)) {
        return;
      }

      sendIntercept("submit", control, event.isTrusted);
    },
    true
  );
}
