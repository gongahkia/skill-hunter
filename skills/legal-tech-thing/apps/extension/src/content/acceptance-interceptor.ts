export const PRE_ACCEPT_INTERCEPT_MESSAGE_TYPE = "extension.preAcceptClick.v1";

const ACCEPTANCE_TEXT_PATTERN =
  /\b(?:accept|agree|continue|submit|confirm|register|sign up|checkout|place order|start trial)\b/i;
const CONSENT_CHECKBOX_PATTERN =
  /\b(?:i agree|i accept|consent|terms|privacy|conditions|policy|legal|authorization)\b/i;

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

export function installPreAcceptInterceptor(doc: Document, pageUrl: string) {
  const root = doc.body ?? doc.documentElement;
  let lastInterceptSignature = "";
  let lastInterceptAtMs = 0;

  const sendIntercept = (eventType: "click" | "submit", control: Element, isTrusted: boolean) => {
    const controlPath = toNodePath(control, root);
    if (controlPath.length === 0) {
      return;
    }

    const controlLabel =
      control instanceof HTMLInputElement && control.type === "checkbox"
        ? getCheckboxLabel(control)
        : getElementLabel(control);

    const signature = `${eventType}:${control.tagName}:${controlLabel}:${controlPath.join(".")}`;
    const now = Date.now();
    if (signature === lastInterceptSignature && now - lastInterceptAtMs <= 300) {
      return;
    }
    lastInterceptSignature = signature;
    lastInterceptAtMs = now;

    const payload: PreAcceptInterceptPayload = {
      url: pageUrl,
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

  doc.addEventListener(
    "click",
    (event) => {
      const control = findLikelyAcceptanceControl(event.target);
      if (!control) {
        return;
      }

      sendIntercept("click", control, event.isTrusted);
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
