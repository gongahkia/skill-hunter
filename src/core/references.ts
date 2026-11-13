import type { Reference, ReferenceMatch } from '@/types';
import {
  cleanText,
  escapeRegex,
  judgmentParagraph,
  localTarget,
  sectionContext,
  sourceLink,
} from './sources';
import type { ScopedDefinition } from './definitions';
import { definitionFor, extractDefinitions } from './definitions';

// Identifier aliases only: no statute text or case corpus is bundled.
const ACTS: Record<string, string> = {
  'Misuse of Drugs Act': 'MDA1973',
  'Penal Code': 'PC1871',
  'Criminal Procedure Code': 'CPC2010',
  'Personal Data Protection Act': 'PDPA2012',
  'Securities and Futures Act': 'SFA2001',
  'Companies Act': 'CoA1967',
  'Employment Act': 'EmA1968',
  'Road Traffic Act': 'RTA1961',
  'Income Tax Act': 'ITA1947',
  'Consumer Protection (Fair Trading) Act': 'CPFTA2003',
  'Arbitration Act': 'AA2001',
  'Small Claims Tribunals Act': 'SCTA1984',
};
export const GLOSSARY: Record<string, string> = {
  'SGHC(A)': 'Appellate Division of the High Court of Singapore',
  'SGHC(I)': 'Singapore International Commercial Court',
  SGCA: 'Court of Appeal of Singapore',
  SGHC: 'General Division of the High Court (High Court before 2 January 2021)',
  SGDC: 'District Court of Singapore',
  SGMC: 'Magistrate’s Court of Singapore',
  SGFC: 'Family Court of Singapore',
  SGHCF: 'Family Division of the High Court of Singapore',
  'SLR(R)': 'Singapore Law Reports (Reissue)',
  SLR: 'Singapore Law Reports',
};
// Sources: Judiciary Practice Directions, court abbreviations and report series tables.
export const GLOSSARY_SOURCE =
  'https://epd2013-supremecourt.judiciary.gov.sg/part-viii-documents-and-authorities-for-use-in-court';
const ACT_LABEL = `[A-Z][A-Za-z’'&(), \\-]*?(?:Act|Code|Regulations|Rules|Order)(?:\\s+\\d{4})?`;
export function normalizeAct(title: string): string {
  return title
    .replace(/^the\s+/i, '')
    .replace(/\s+\d{4}$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function knownActUrl(title: string): string | undefined {
  const slug = ACTS[normalizeAct(title)];
  return slug ? `https://sso.agc.gov.sg/Act/${slug}?WholeDoc=1` : undefined;
}
export function caseUrl(citation: string): string | undefined {
  const m = /^\[(\d{4})\]\s+(SG[A-Z]+(?:\([AI]\))?)\s+(\d+)$/.exec(citation.trim());
  return m
    ? `https://www.elitigation.sg/gd/s/${m[1]}_${m[2]?.replace(/[()]/g, '')}_${m[3]}`
    : undefined;
}
export function actAliases(root: Element): Map<string, string> {
  const aliases = new Map<string, string>();
  const text = cleanText(root);
  const pattern = new RegExp(
    `(${ACT_LABEL})(?:\\s*\\([^)]*(?:Rev Ed|Revised Edition)[^)]*\\))?\\s*\\((?:the\\s+)?[“"]([A-Z][A-Z0-9]{1,12})[”"]\\)`,
    'g'
  );
  for (const m of text.matchAll(pattern)) {
    const prior = aliases.get(m[2] ?? '');
    aliases.set(m[2] ?? '', prior && prior !== m[1] ? '' : (m[1] ?? ''));
  }
  return aliases;
}
export interface ReferenceContext {
  aliases: Map<string, string>;
  definitions: ScopedDefinition[];
  versions: Map<string, string>;
}
export function referenceContext(root: Element): ReferenceContext {
  const versions = new Map<string, string>();
  const pattern =
    /\(([^)]*(?:Rev Ed|Revised Edition)[^)]*)\)\s*\((?:the\s+)?[“"]([A-Z][A-Z0-9]{1,12})[”"]\)/g;
  for (const m of cleanText(root).matchAll(pattern)) versions.set(m[2] ?? '', m[1] ?? '');
  return { aliases: actAliases(root), definitions: extractDefinitions(root), versions };
}
export function detectReferences(
  text: string,
  el: Element,
  root: Element,
  url: string,
  context = referenceContext(root)
): ReferenceMatch[] {
  const results: ReferenceMatch[] = [];
  const add = (start: number, label: string, reference: Omit<Reference, 'label'>): void => {
    const end = start + label.length;
    if (!results.some((r) => start < r.end && end > r.start))
      results.push({ start, end, reference: { ...reference, label } });
  };
  const aliases = context.aliases;
  const aliasLabels = [...aliases.keys()].filter((key) => aliases.get(key)).map(escapeRegex);
  const actLabel = aliasLabels.length ? `(?:${ACT_LABEL}|${aliasLabels.join('|')})` : ACT_LABEL;
  const statutory = new RegExp(
    `\\b(?:sections?|ss?\\.?)\\s+(\\d+[A-Z]*(?:\\([\\w]+\\))*)(?:\\s+(?:and|to)\\s+\\d+[A-Z]*(?:\\(\\w+\\))*)?\\s+(?:of\\s+)?(?:the\\s+)?(${actLabel})(?:\\s*\\(([^)]*(?:Rev Ed|Revised Edition)[^)]*)\\))?`,
    'g'
  );
  for (const m of text.matchAll(statutory)) {
    const act = aliases.get(m[2] ?? '') || m[2] || '';
    add(m.index ?? 0, m[0], {
      kind: 'statute',
      act,
      section: m[1],
      url: knownActUrl(act),
      version: m[3] || context.versions.get(m[2] ?? ''),
    });
  }
  for (const m of text.matchAll(
    /\[\d{4}\]\s+(?:SG[A-Z]+(?:\([AI]\))?\s+\d+|\d+\s+SLR(?:\(R\))?\s+\d+)/g
  )) {
    add(m.index ?? 0, m[0], { kind: 'case', url: caseUrl(m[0]) });
  }
  // Existing native links are decorated, never replaced or intercepted.
  const anchor = el.closest('a[href]');
  if (anchor) {
    const href = sourceLink(anchor.getAttribute('href') ?? '', url);
    if (href) {
      const parsed = new URL(href);
      const current = new URL(url);
      let target: Element | undefined;
      if (parsed.pathname === current.pathname && parsed.hash) {
        try {
          target =
            root.ownerDocument.getElementById(decodeURIComponent(parsed.hash.slice(1))) ??
            undefined;
        } catch {
          /* malformed anchor */
        }
      }
      results.length = 0;
      add(
        0,
        text,
        target
          ? { kind: 'local', target, url: href }
          : {
              kind: parsed.hostname === 'sso.agc.gov.sg' ? 'statute' : 'case',
              url: href,
              section:
                /\b(?:sections?|s\.?)\s+(\d+[A-Z]*(?:\(\w+\))*)/i.exec(text)?.[1] ||
                /pr(\d+[A-Z]*)/.exec(parsed.hash || parsed.searchParams.get('ProvIds') || '')?.[1],
            }
      );
      return results;
    }
  }
  for (const m of text.matchAll(
    /\b(sections?|ss?\.?)\s+(\d+[A-Z]*(?:\(\w+\))*)|\b(subsections?|paragraphs?|paras?\.?)\s+((?:\(\w+\))+)/gi
  )) {
    // An unresolved external citation must not become an incorrect local link.
    const tail = text.slice((m.index ?? 0) + m[0].length);
    if (/^\s+(?:of\s+)?(?:the\s+)?[A-Z]/.test(tail) && !/^\s+(?:and|or)\b/.test(tail)) continue;
    const section = m[2] || `${sectionContext(el) ?? ''}${m[4] ?? ''}`;
    const target = localTarget(root, section);
    if (target)
      add(m.index ?? 0, m[0], { kind: 'local', target, url: `${url.split('#')[0]}#${target.id}` });
  }
  if (root.id === 'divJudgement') {
    for (const m of text.matchAll(
      /\b(?:paragraphs?|paras?\.?)\s+\[?(\d+)\]?|\babove at\s+\[(\d+)\]|\bat\s+\[(\d+)\]\s+(?:above|below)/gi
    )) {
      const target = judgmentParagraph(root, m[1] || m[2] || m[3] || '');
      if (target) add(m.index ?? 0, m[0], { kind: 'local', target, url });
    }
  }
  if (!el.closest('.def')) {
    const defs = context.definitions;
    const terms = [...new Set(defs.map((d) => d.term))].sort((a, b) => b.length - a.length);
    if (terms.length) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${terms.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}_])`,
        'giu'
      );
      for (const m of text.matchAll(pattern)) {
        const def = definitionFor(m[0], el, root, defs);
        if (def) add(m.index ?? 0, m[0], { kind: 'definition', text: def.text, url });
      }
    }
  }
  // Explicitly quoted defined terms with an identified Act can be resolved on hover.
  for (const m of text.matchAll(
    new RegExp(
      `[“"]([^”"]+)[”"]\\s+(?:as defined in|within the meaning of)\\s+(?:the\\s+)?(${actLabel})`,
      'g'
    )
  )) {
    const act = aliases.get(m[2] ?? '') || m[2];
    add(m.index ?? 0, m[0], {
      kind: 'definition',
      act,
      text: m[1],
      url: act ? knownActUrl(act) : undefined,
    });
  }
  // These are lookup candidates, never bundled definitions. Resolve only when a
  // paragraph explicitly identifies one Act and a provision establishing scope.
  if (root.id === 'divJudgement') {
    const statutoryRefs = results
      .map((r) => r.reference)
      .filter((r) => r.kind === 'statute' && r.act && r.section);
    const acts = new Set(statutoryRefs.map((r) => r.act));
    const contextRef = acts.size === 1 ? statutoryRefs[0] : undefined;
    if (contextRef) {
      const candidates =
        /\b(?:controlled drugs?|public servant|unfair practice|property|person|document|contract|supplier|consumer|court|company|officer|employee|employer)\b/gi;
      for (const m of text.matchAll(candidates)) {
        add(m.index ?? 0, m[0], { ...contextRef, kind: 'definition', text: m[0] });
      }
    }
  }
  const glossary = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${Object.keys(GLOSSARY)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|')})(?![\\p{L}\\p{N}_])`,
    'gu'
  );
  for (const m of text.matchAll(glossary))
    add(m.index ?? 0, m[0], { kind: 'abbreviation', text: GLOSSARY[m[0]], url: GLOSSARY_SOURCE });
  return results.sort((a, b) => a.start - b.start);
}
