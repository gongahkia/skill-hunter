import type { PageSummary, Preview } from '@/types';
import { isSupportedUrl } from '@/utils/network';

export function cleanText(node: Node | null | undefined): string {
  const collect = (current: Node): string => {
    if (current.nodeType === Node.TEXT_NODE) return current.textContent ?? '';
    const block =
      current instanceof Element &&
      current.matches('div,p,br,td,th,tr,li,section,h1,h2,h3,h4,blockquote');
    const text = Array.from(current.childNodes).map(collect).join('');
    return block ? ` ${text} ` : text;
  };
  return node ? collect(node).replace(/\s+/g, ' ').trim() : '';
}
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function parseHtml(html: string): Document {
  // A template does not load images/frames or execute fetched scripts.
  const doc = document.implementation.createHTMLDocument('');
  const template = doc.createElement('template');
  template.innerHTML = html;
  template.content
    .querySelectorAll('script,style,iframe,object,embed,link,img')
    .forEach((el) => el.remove());
  doc.body.append(template.content);
  return doc;
}
export function contentRoot(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>('#legisContent, #divJudgement');
}
export function pageSummary(doc: Document, url: string): PageSummary {
  const elit = new URL(url).hostname === 'www.elitigation.sg';
  const citation = cleanText(doc.querySelector('.HN-NeutralCit')) || (elit ? doc.title : '');
  const names = Array.from(doc.querySelectorAll('.HN-CaseName')).map(cleanText);
  return {
    site: elit ? 'elit' : 'sso',
    title: elit
      ? names.find((name) => !/^\[\d{4}\]/.test(name)) || citation
      : cleanText(doc.querySelector('.legis-title, .actHd')) ||
        doc.title.split('|')[0]?.trim() ||
        'Legislation',
    type: elit
      ? 'Judgment'
      : new URL(url).pathname.startsWith('/SL/')
        ? 'Subsidiary legislation'
        : new URL(url).pathname.startsWith('/Bills-Supp/')
          ? 'Supplement'
          : 'Act',
    status: elit ? '' : cleanText(doc.querySelector('.status-value')),
    date: cleanText(doc.querySelector(elit ? '.Judg-Date-Reserved, .Judg-Date' : '.cDate')),
    revisedTitle: cleanText(doc.querySelector('.revdHdr')),
    court: elit
      ? doc.querySelector('.HN-Coram')?.childNodes[0]?.textContent?.split('—')[0]?.trim() || ''
      : '',
    citation,
    hasPdf: !!doc.querySelector('a[href*="/pdf"], .fa-file-pdf-o'),
    sourceUrl: url,
  };
}
export function localTarget(root: Element, section: string): Element | undefined {
  const parts = section.match(/^(\d+[A-Z]*)(.*)$/i);
  if (!parts) return undefined;
  const base = parts[1]?.toUpperCase();
  const subsection = /^\((\w+)\)/.exec(parts[2] ?? '')?.[1];
  const ids = subsection ? [`pr${base}-ss${subsection}-`, `pr${base}-he-`] : [`pr${base}-he-`];
  return ids
    .map((id) => Array.from(root.querySelectorAll('[id]')).find((el) => el.id === id))
    .find(Boolean);
}
export function provisionText(target: Element): string {
  if (/-ss\w+-/.test(target.id) && cleanText(target)) return cleanText(target);
  // Collect in source order up to the next provision heading, including nested tables.
  const root = target.closest('#legisContent') ?? target.ownerDocument.body;
  const walker = target.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let collecting = false,
    out = '';
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === target) collecting = true;
    else if (
      collecting &&
      node instanceof Element &&
      !target.contains(node) &&
      node.matches('td[class*="Hdr"], .partHdr, [id*="-he-"]')
    )
      break;
    if (collecting && node instanceof Text) out += node.data;
    if (out.length > 7000) break;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, 7000);
}
export function sectionContext(el: Element): string | undefined {
  const root = el.closest('#legisContent');
  if (!root) return undefined;
  let section: string | undefined;
  for (const candidate of Array.from(root.querySelectorAll('[id]'))) {
    if (candidate.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) break;
    const match = /^pr(\d+[A-Z]*)-he-$/i.exec(candidate.id);
    if (match) section = match[1];
  }
  return section;
}
export function judgmentParagraph(root: Element, number: string): Element | undefined {
  return Array.from(root.querySelectorAll('.Judg-1')).find((p) =>
    new RegExp(`^${escapeRegex(number)}(?:\\s|\\u2003)`).test(p.textContent ?? '')
  );
}
export function sourceLink(value: string, base: string): string | undefined {
  try {
    const url = new URL(value, base);
    if (url.hostname === 'www.elitigation.sg')
      url.pathname = url.pathname.replace('/gdviewer/s/', '/gd/s/');
    return isSupportedUrl(url.href) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function searchCandidates(
  doc: Document,
  base: string
): Array<{ title: string; url: string }> {
  const found = new Map<string, string>();
  doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const url = sourceLink(a.getAttribute('href') ?? '', base);
    if (url && cleanText(a) && !found.has(url)) found.set(url, cleanText(a));
  });
  return Array.from(found, ([url, title]) => ({ title, url }));
}
export function statuteVersion(doc: Document, url: string): string {
  const parsed = new URL(url);
  const revision = parsed.searchParams.get('RevDate');
  if (revision)
    return `Version requested: ${revision}. ${cleanText(doc.querySelector('.status-value'))}`;
  if (parsed.pathname.startsWith('/Act-Rev/'))
    return `Cited revised edition. ${cleanText(doc.querySelector('.revdHdr, .status-value'))}`;
  return `Current version — may differ from the version discussed. ${cleanText(doc.querySelector('.status-value'))}`;
}
export function localPreview(target: Element, label: string, url: string): Preview {
  return {
    kind: 'Cross-reference',
    title: label,
    text: target.closest('#legisContent') ? provisionText(target) : cleanText(target),
    detail:
      /-he-$/.test(target.id) && /subsection|paragraph/i.test(label)
        ? 'Enclosing section context from this page; no exact sub-provision anchor was found.'
        : 'From this page and its displayed version',
    url,
  };
}
