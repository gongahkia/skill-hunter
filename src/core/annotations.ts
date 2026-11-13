import type { Reference } from '@/types';
import { ANNOTATION_ATTR } from '@/utils/constants';
import { detectReferences, referenceContext } from './references';
import { cleanText } from './sources';

const SKIP =
  'script,style,noscript,textarea,input,select,button,pre,code,nav,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],#skill-hunter-previews';
const BLOCK = 'p,td,th,li,blockquote,h1,h2,h3,h4,h5,h6,.Judg-1,.Judg-Quote-0,.Judg-List-1';
export class Annotations {
  private counter = 0;
  get connected(): boolean {
    return this.root.isConnected;
  }
  private readonly references = new Map<string, Reference>();
  constructor(
    private root: HTMLElement,
    private url: string
  ) {}
  reference(el: Element): Reference | undefined {
    return this.references.get(el.getAttribute(ANNOTATION_ATTR) ?? '');
  }
  scan(): void {
    const groups = new Map<Element, Text[]>();
    const walker = this.root.ownerDocument.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      const parent = text.parentElement;
      if (!parent || parent.closest(`${SKIP},[${ANNOTATION_ATTR}]`) || !text.data) continue;
      const block = parent.closest('a[href]') ?? parent.closest(BLOCK) ?? parent;
      const nodes = groups.get(block) ?? [];
      nodes.push(text);
      groups.set(block, nodes);
    }
    const context = referenceContext(this.root);
    // Compute all ranges before mutation; offsets refer only to original text nodes.
    for (const [block, nodes] of groups) {
      const text = nodes.map((node) => node.data).join('');
      if (!text.trim()) continue;
      const header = /^pr(\d+[A-Z]*)-he-$/i.exec(block.id);
      const matches = header
        ? [
            {
              start: 0,
              end: text.length,
              reference: {
                kind: 'citing' as const,
                label: text,
                section: header[1],
                act: cleanText(document.querySelector('.legis-title, .actHd')) || document.title,
                url: this.url,
              },
            },
          ]
        : detectReferences(text, block, this.root, this.url, context);
      let offset = 0;
      const positions = nodes.map((node) => {
        const start = offset;
        offset += node.length;
        return { node, start, end: offset };
      });
      for (const match of [...matches].reverse()) {
        const id = String(++this.counter);
        this.references.set(id, match.reference);
        let first = true;
        for (const pos of positions) {
          const start = Math.max(match.start, pos.start) - pos.start;
          const end = Math.min(match.end, pos.end) - pos.start;
          if (end <= start) continue;
          // splitText keeps all original inline elements and their handlers in place.
          if (end < pos.node.length) pos.node.splitText(end);
          const portion = start ? pos.node.splitText(start) : pos.node;
          const span = document.createElement('span');
          span.setAttribute(ANNOTATION_ATTR, id);
          span.className = 'skill-hunter-reference';
          if (first && !portion.parentElement?.closest('a[href]')) {
            span.tabIndex = 0;
            span.setAttribute('role', 'button');
            span.setAttribute('aria-label', `${match.reference.label}: preview`);
          }
          first = false;
          portion.replaceWith(span);
          span.append(portion);
        }
      }
    }
  }
  clear(): void {
    const parents = new Set<Node>();
    this.root.querySelectorAll(`[${ANNOTATION_ATTR}]`).forEach((el) => {
      if (!this.reference(el)) return;
      if (el.parentNode) parents.add(el.parentNode);
      el.replaceWith(...Array.from(el.childNodes));
    });
    parents.forEach((parent) => parent.normalize());
    this.references.clear();
  }
}
