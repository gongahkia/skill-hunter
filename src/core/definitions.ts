import { cleanText, sectionContext } from './sources';
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
  for (const cell of Array.from(root.querySelectorAll('.def'))) {
    const text = cleanText(cell);
    const term = /^[“"]([^”"]+)[”"]/.exec(text)?.[1];
    if (!term) continue;
    // The scope lead-in is in the current interpretation provision, not an arbitrary earlier cell.
    const section = sectionContext(cell);
    const preceding = Array.from(root.querySelectorAll('td')).filter(
      (td) =>
        !!(td.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        sectionContext(td) === section
    );
    const intro = preceding.map(cleanText).join(' ');
    let scope = 'act';
    if (/\b(?:this section|this regulation)\b/i.test(intro)) scope = `section:${section}`;
    else if (/\bthis Part\b/i.test(intro)) scope = `part:${partAt(cell, root)}`;
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
