import { cleanText, sectionContext, sectionNumber } from './sources';
export interface ScopedDefinition {
  term: string;
  text: string;
  scope: string;
}

function partAt(el: Element, root: Element): string {
  let part = '';
  for (const heading of Array.from(root.querySelectorAll('.partHdr, .partNo'))) {
    if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) break;
    part = cleanText(heading);
  }
  return part;
}
export function extractDefinitions(root: Element): ScopedDefinition[] {
  const result: ScopedDefinition[] = [];
  let intro = '',
    section = '',
    part = '';
  let excluded: Element | null = null;
  // read introductions in source order, including text around nested definition tables.
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        excluded?.contains(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    }
  );
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) {
      intro += node.data;
      continue;
    }
    if (!(node instanceof Element)) continue;
    if (node.matches('.partHdr, .partNo')) {
      part = cleanText(node);
      intro = '';
      continue;
    }
    const heading = sectionNumber(node);
    if (heading && (/-he-$/i.test(node.id) || node.matches('[class*="prov"][class*="Hdr"]'))) {
      section = heading;
      intro = '';
      excluded = node;
      continue;
    }
    if (!node.matches('.def')) {
      if (node.matches('div,p,br,td,th,tr,li,section')) intro += ' ';
      continue;
    }
    excluded = node;
    const text = cleanText(node);
    const term = /^[“"]([^”"]+)[”"]/.exec(text)?.[1];
    if (!term) continue;
    intro = intro.replace(/\s+/g, ' ').trim();
    let scope = 'act';
    if (/\b(?:this section|this regulation)\b/i.test(intro)) scope = `section:${section}`;
    else if (/\bthis Part\b/i.test(intro)) scope = `part:${part}`;
    else if (!/\b(?:this Act|these Regulations|these Rules|this Order)\b/i.test(intro)) continue;
    result.push({ term, text, scope });
  }
  return result;
}
export function definitionFor(
  term: string,
  el: Element,
  root: Element,
  defs: ScopedDefinition[]
): ScopedDefinition | undefined {
  const scopes = [`section:${sectionContext(el)}`, `part:${partAt(el, root)}`, 'act'];
  for (const scope of scopes) {
    const matches = defs.filter(
      (d) => d.scope === scope && d.term.toLocaleLowerCase() === term.toLocaleLowerCase()
    );
    if (matches.length)
      return new Set(matches.map((d) => d.text)).size === 1 ? matches[0] : undefined;
  }
  return undefined;
}
