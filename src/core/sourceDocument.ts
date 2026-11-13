/** Preserve the legislative DOM, enhancing text nodes only after allowlist sanitization. */
import type { Definition } from '@/types';
import { LOGICAL_CONNECTORS, SKILL_HUNTER_IDS } from '@/utils/constants';
import { DOMParsingError } from '@/utils/errorHandler';

const SAFE_TAGS = new Set(
  'a abbr b blockquote br caption col colgroup dd del div dl dt em h1 h2 h3 h4 h5 h6 hr i img ins li ol p pre s small span strong sub sup table tbody td th thead tfoot tr u ul'.split(
    ' '
  )
);
const DROP_TAGS = new Set(
  'script style iframe object embed form input button select textarea link meta base template noscript'.split(
    ' '
  )
);
const SAFE_ATTRIBUTES = new Set(
  'id class title lang dir colspan rowspan scope headers start value type width height alt'.split(
    ' '
  )
);

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sanitize(source: string): HTMLDivElement {
  const template = document.createElement('template');
  template.innerHTML = source;
  const elements = Array.from(template.content.querySelectorAll('*'));
  for (const el of elements) {
    const tag = el.localName;
    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (!SAFE_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    const sourceUrl = el.getAttribute(tag === 'a' ? 'href' : 'src');
    for (const attr of Array.from(el.attributes)) {
      if (!SAFE_ATTRIBUTES.has(attr.name)) el.removeAttribute(attr.name);
    }
    // Source content cannot impersonate extension controls or tooltip markup.
    if (el.id.startsWith('skill-hunter-')) el.removeAttribute('id');
    const classes = (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter((name) =>
        /^(?:prov\w*|part\w*|def|fs|front|body|schedule|actHd|longTitle|cDate|revd\w*)$/.test(name)
      );
    el.setAttribute('class', classes.join(' '));
    if ((tag === 'a' || tag === 'img') && sourceUrl) {
      const url = safeSourceUrl(sourceUrl);
      if (url) {
        el.setAttribute(tag === 'a' ? 'href' : 'src', url);
        if (tag === 'a') {
          const target = new URL(url);
          const current = new URL(window.location.href);
          if (
            target.origin === current.origin &&
            target.pathname === current.pathname &&
            target.hash
          ) {
            try {
              el.setAttribute(
                SKILL_HUNTER_IDS.TOC_TARGET_ATTR,
                decodeURIComponent(target.hash.slice(1))
              );
            } catch {
              el.setAttribute(SKILL_HUNTER_IDS.TOC_TARGET_ATTR, target.hash.slice(1));
            }
          } else {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }
      }
    }
  }
  const root = document.createElement('div');
  root.className = 'source-legislation';
  root.append(template.content);
  return root;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderSourceDocument(source: string, definitions: Definition[]): string {
  const root = sanitize(source);
  if (!root.textContent?.trim())
    throw new DOMParsingError('No readable legislation remains after sanitization');
  for (const cell of root.querySelectorAll('td')) {
    const isSection = Array.from(cell.classList).some((name) => /^prov\w*Hdr$/.test(name));
    if (!isSection && !cell.classList.contains('partHdr')) continue;
    const heading = document.createElement(isSection ? 'h2' : 'h3');
    heading.className = isSection ? 'section-header' : 'provision-header';
    if (cell.id) {
      heading.id = cell.id;
      cell.removeAttribute('id');
    }
    heading.append(...Array.from(cell.childNodes));
    cell.append(heading);
  }

  const definitionMap = new Map<string, string>();
  for (const pair of definitions) {
    for (const [term, description] of Object.entries(pair)) {
      if (term) definitionMap.set(term.toLocaleLowerCase(), description);
    }
  }
  const terms = Array.from(definitionMap.keys()).sort((a, b) => b.length - a.length);
  const definitionPattern = terms.length ? terms.map(escapeRegex).join('|') : '(?!)';
  const connectors = [...LOGICAL_CONNECTORS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:sections?\\s+\\d+[A-Z]*(?:\\(\\w+\\))*|subsections?\\s+\\(\\w+\\)(?:\\(\\w+\\))*|${definitionPattern}|${connectors})(?![\\p{L}\\p{N}_])`,
    'giu'
  );
  const targets = new Set(Array.from(root.querySelectorAll('[id]'), (el) => el.id));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const textNodes: Array<{ node: Text; section: string | null }> = [];
  let section: string | null = null;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current instanceof HTMLElement && current.matches('.section-header'))
      section = current.id || null;
    if (current instanceof Text) textNodes.push({ node: current, section });
  }
  for (const { node, section } of textNodes) {
    if (node.parentElement?.closest('a, h1, h2, h3, h4, h5, h6, .def, pre')) continue;
    const text = node.data;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      fragment.append(text.slice(offset, match.index));
      const definition = definitionMap.get(match[0].toLocaleLowerCase());
      const reference = /^sections?\s+(\d+[A-Z]*)/i.exec(match[0]);
      const isReference = !!reference || /^subsections?\s+/i.test(match[0]);
      const target = reference ? `pr${reference[1].toUpperCase()}-he-` : section;
      const highlight = document.createElement(isReference ? 'span' : definition ? 'span' : 'b');
      if (isReference) {
        if (target && targets.has(target)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'cross-ref';
          button.textContent = match[0];
          button.setAttribute(SKILL_HUNTER_IDS.TOC_TARGET_ATTR, target);
          highlight.append(button);
        } else {
          highlight.textContent = match[0];
        }
      } else if (definition) {
        highlight.className = 'statute-term';
        highlight.setAttribute(SKILL_HUNTER_IDS.TOOLTIP_ATTR, definition);
        highlight.textContent = match[0];
      } else {
        const italic = document.createElement('i');
        italic.textContent = match[0];
        highlight.append(italic);
      }
      fragment.append(highlight);
      offset = match.index + match[0].length;
    }
    if (offset) {
      fragment.append(text.slice(offset));
      node.replaceWith(fragment);
    }
  }
  return root.outerHTML;
}
