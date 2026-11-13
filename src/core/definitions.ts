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
  let intro = '',
    section = '',
    part = '';
  // One source-order pass. Repeated DOM queries per definition are prohibitively
  // expensive on large instruments such as the Penal Code.
  for (const cell of Array.from(root.querySelectorAll('td, .partNo, .def, [id*="-he-"]'))) {
    if (cell.matches('.partHdr, .partNo')) {
      part = cleanText(cell);
      intro = '';
    }
    const heading = /^pr(\d+[A-Z]*)-he-$/i.exec(cell.id);
    if (heading) {
      section = heading[1] ?? '';
      intro = '';
      continue;
    }
    if (!cell.matches('.def')) {
      if (!cell.querySelector('.def, td, [id*="-he-"]')) intro += ` ${cleanText(cell)}`;
      continue;
    }
    const text = cleanText(cell);
    const term = /^[“"]([^”"]+)[”"]/.exec(text)?.[1];
    if (!term) continue;
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
