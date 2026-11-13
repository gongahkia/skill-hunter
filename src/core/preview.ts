import type { FetchResponse, Lookup, Preview, Reference, SourceLookup } from '@/types';
import { lookupUrl } from '@/utils/network';
import { actAliases, caseUrl, knownActUrl, normalizeAct } from './references';
import {
  cleanText,
  contentRoot,
  editionUrl,
  escapeRegex,
  localPreview,
  localTarget,
  pageSummary,
  paragraphPreview,
  parseHtml,
  provisionText,
  searchCandidates,
  statuteVersion,
} from './sources';
import { definitionFor, extractDefinitions } from './definitions';

function caseNameKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\blimited\b/g, 'ltd')
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export class PreviewResolver {
  private cache = new Map<string, Promise<Document>>();
  private generation = 0;
  private disposed = false;
  clear(): void {
    this.disposed = true;
    this.generation++;
    this.cache.clear();
  }
  private async load(lookup: Lookup): Promise<Document> {
    if (this.disposed) throw new Error('Lookup dismissed');
    const key = `${lookup.kind === 'rendered' ? 'rendered:' : ''}${lookupUrl(lookup)}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const request = (async () => {
      const response: FetchResponse = await chrome.runtime.sendMessage({
        action: 'lookup',
        lookup,
      });
      if (!response?.ok || typeof response.html !== 'string')
        throw new Error(response?.error || 'Source unavailable');
      if (generation !== this.generation) throw new Error('Lookup dismissed');
      return parseHtml(response.html);
    })();
    this.cache.set(key, request);
    if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value as string);
    void request.catch(() => {
      if (this.cache.get(key) === request) this.cache.delete(key);
    });
    return request;
  }
  private async statuteDocument(url: string, isCurrent: () => boolean): Promise<Document> {
    if (!isCurrent()) throw new Error('Lookup dismissed');
    let doc: Document | undefined;
    try {
      doc = await this.load({ kind: 'document', url });
    } catch {
      /* Read the browser source below. */
    }
    if (!isCurrent()) throw new Error('Lookup dismissed');
    if (!doc || !contentRoot(doc)?.querySelector('[id*="-he-"], td[class*="prov"]'))
      doc = await this.load({ kind: 'rendered', resource: { kind: 'document', url } });
    if (!contentRoot(doc)?.textContent?.trim())
      throw new Error('SSO did not provide readable legislation in the browser.');
    return doc;
  }
  private async statuteUrl(ref: Reference, isCurrent: () => boolean): Promise<string> {
    if (ref.url) return ref.url;
    if (!ref.act) throw new Error('The referenced instrument could not be identified');
    const lookup: SourceLookup = { kind: 'statute-search', title: ref.act };
    if (!isCurrent()) throw new Error('Lookup dismissed');
    let doc: Document;
    try {
      doc = await this.load(lookup);
    } catch {
      if (!isCurrent()) throw new Error('Lookup dismissed');
      doc = await this.load({ kind: 'rendered', resource: lookup });
    }
    const matches = (source: Document, base: string): string[] =>
      searchCandidates(source, base)
        .filter(
          (c) => normalizeAct(c.title).toLowerCase() === normalizeAct(ref.act ?? '').toLowerCase()
        )
        .map((c) => c.url);
    let urls = matches(doc, lookupUrl(lookup));
    if (!urls.length) {
      if (!isCurrent()) throw new Error('Lookup dismissed');
      doc = await this.load({ kind: 'rendered', resource: lookup });
      urls = matches(doc, lookupUrl(lookup));
    }
    if (!urls.length) {
      if (!isCurrent()) throw new Error('Lookup dismissed');
      const catalogue: SourceLookup = { kind: 'statute-catalogue' };
      try {
        doc = await this.load(catalogue);
      } catch {
        if (!isCurrent()) throw new Error('Lookup dismissed');
        doc = await this.load({ kind: 'rendered', resource: catalogue });
      }
      urls = matches(doc, lookupUrl(catalogue));
      if (!urls.length) {
        doc = await this.load({ kind: 'rendered', resource: catalogue });
        urls = matches(doc, lookupUrl(catalogue));
      }
    }
    if (new Set(urls).size !== 1)
      throw new Error(
        'SSO did not return a unique title match. Open the source search to select the instrument.'
      );
    return urls[0] ?? '';
  }
  async resolve(
    ref: Reference,
    pageUrl: string,
    isCurrent = (): boolean => true
  ): Promise<Preview> {
    if (ref.kind === 'abbreviation')
      return { kind: 'Legal abbreviation', title: ref.label, text: ref.text ?? '', url: ref.url };
    if (ref.kind === 'local' && ref.target)
      return localPreview(ref.target, ref.label, ref.url || pageUrl);
    if (ref.kind === 'definition' && !ref.act)
      return {
        kind: 'Definition',
        title: ref.label,
        text: ref.text ?? '',
        detail: 'From this page and its displayed version',
        url: pageUrl,
      };
    if (ref.kind === 'citing') return this.citingCases(ref, isCurrent);
    if (ref.kind === 'case') return this.casePreview(ref, isCurrent);
    if (ref.quote)
      return {
        kind: 'Legislation quoted in judgment',
        title: `${ref.act || ref.label}${ref.section ? ` · section ${ref.section}` : ''}`,
        text: ref.quote,
        detail: `Verbatim quotation from this judgment; any omissions are retained.${ref.version ? ` Cited edition: ${ref.version}.` : ''}`,
        url: pageUrl,
      };
    let sourceUrl = await this.statuteUrl(ref, isCurrent);
    const url = new URL(sourceUrl);
    url.searchParams.set('WholeDoc', '1');
    sourceUrl = url.href;
    let doc = await this.statuteDocument(sourceUrl, isCurrent);
    let versionWarning = '';
    if (ref.version && !url.searchParams.has('RevDate') && !url.pathname.startsWith('/Act-Rev/')) {
      const historical = editionUrl(doc, sourceUrl, ref.version);
      if (historical) {
        try {
          doc = await this.statuteDocument(historical, isCurrent);
          sourceUrl = historical;
        } catch {
          versionWarning = `Cited ${ref.version} could not be loaded. Showing current text, which may differ.`;
        }
      } else
        versionWarning = `Cited ${ref.version} could not be verified. Showing current text, which may differ.`;
    }
    const root = contentRoot(doc) as HTMLElement;
    const summary = pageSummary(doc, sourceUrl);
    if (ref.kind === 'definition') {
      const scope = ref.section ? localTarget(root, ref.section) : undefined;
      const def = definitionFor(ref.text ?? '', scope ?? root, root, extractDefinitions(root));
      if (!def) throw new Error('No unambiguous definition was found in the identified scope');
      return {
        kind: 'Definition',
        title: ref.text ?? ref.label,
        text: def.text,
        detail: versionWarning || statuteVersion(doc, sourceUrl),
        url: sourceUrl,
      };
    }
    const finalUrl = new URL(sourceUrl);
    const hashSection = /pr(\d+[A-Z]*)(?:-ss(\w+))?/.exec(finalUrl.hash);
    const section =
      ref.section ||
      (hashSection ? `${hashSection[1]}${hashSection[2] ? `(${hashSection[2]})` : ''}` : '');
    const target = section ? localTarget(root, section) : undefined;
    if (section && !target)
      throw new Error('The referenced provision was not found in this version');
    if (target?.id) finalUrl.hash = target.id;
    return {
      kind: versionWarning ? 'Legislation · current text' : 'Legislation',
      title: `${summary.title}${section ? ` · section ${section}` : ''}`,
      text: target
        ? provisionText(target)
        : cleanText(root.querySelector('.longTitle')) || 'Open the source to read this instrument.',
      detail: versionWarning || statuteVersion(doc, sourceUrl),
      url: finalUrl.href,
    };
  }
  private async casePreview(ref: Reference, isCurrent: () => boolean): Promise<Preview> {
    let url = ref.url || caseUrl(ref.label);
    let nameMatched = false;
    if (!url) {
      const lookup: Lookup = { kind: 'case-search', phrase: ref.caseName || `"${ref.label}"` };
      const search = await this.load(lookup);
      const candidates = searchCandidates(search, lookupUrl(lookup)).slice(0, 10);
      const matches: Array<{ url: string; doc: Document }> = [];
      // Only fetch titles matching the parties, rather than ten unrelated citing judgments.
      const parties = ref.caseName?.split(/\s+v\s+/i).map((s) =>
        caseNameKey(s)
          .replace(/\band another.*$/, '')
          .trim()
      );
      for (const candidate of candidates) {
        if (!isCurrent()) throw new Error('Lookup dismissed');
        if (parties && !parties.every((party) => caseNameKey(candidate.title).includes(party)))
          continue;
        try {
          const doc = await this.load({ kind: 'document', url: candidate.url });
          const summary = pageSummary(doc, candidate.url);
          const nameMatches =
            !!ref.caseName && caseNameKey(summary.title) === caseNameKey(ref.caseName);
          const headers = Array.from(doc.querySelectorAll('.HN-NeutralCit, .HN-CaseName'))
            .map(cleanText)
            .join(' ');
          if (nameMatches || headers.includes(ref.label)) matches.push({ url: candidate.url, doc });
        } catch {
          /* Try the other matching public judgments. */
        }
      }
      if (matches.length !== 1)
        return {
          kind: 'Case search',
          title: ref.caseName || ref.label,
          text:
            matches.length > 1
              ? 'Several judgments have this case name. Select a source to read the correct one.'
              : 'The public search did not identify a unique judgment. Open the search results to select it.',
          url: lookupUrl(lookup),
          links: matches.map((match) => ({
            title: pageSummary(match.doc, match.url).citation,
            url: match.url,
          })),
        };
      url = matches[0]?.url;
      nameMatched = !!ref.caseName;
    }
    if (!url) throw new Error('No judgment source was identified');
    const doc = await this.load({ kind: 'document', url });
    const root = doc.querySelector('#divJudgement');
    if (!root) throw new Error('No public judgment was returned');
    const summary = pageSummary(doc, url);
    const excerpt = paragraphPreview(root, ref.paragraphs);
    return {
      kind: 'Judgment',
      title: summary.title,
      text: excerpt.text || 'The requested paragraphs were not found in this public copy.',
      detail: [
        summary.citation,
        summary.court,
        summary.date,
        excerpt.detail,
        nameMatched
          ? 'Matched by the cited case name; the SLR citation is not independently verified.'
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      url,
    };
  }
  private async citingCases(ref: Reference, isCurrent: () => boolean): Promise<Preview> {
    const act = normalizeAct(ref.act ?? '');
    const section = ref.section ?? '';
    const phrase = `"${act.replace(/"/g, '')}" AND ("section ${section}" OR "s ${section}" OR "s. ${section}")`;
    const lookup: Lookup = { kind: 'case-search', phrase };
    const url = lookupUrl(lookup);
    const doc = await this.load(lookup);
    const candidates = searchCandidates(doc, url).slice(0, 5);
    const links: NonNullable<Preview['links']> = [];
    for (const candidate of candidates) {
      if (!isCurrent()) break;
      try {
        const judgment = await this.load({ kind: 'document', url: candidate.url });
        const root = judgment.querySelector('#divJudgement');
        if (!root) continue;
        const text = cleanText(root);
        const labels = [
          act,
          ...Array.from(actAliases(root))
            .filter(([, name]) => normalizeAct(name) === act)
            .map(([alias]) => alias),
        ];
        const pattern = new RegExp(
          `\\b(?:sections?|ss?\\.?)\\s+${escapeRegex(section)}(?![\\dA-Z])(?:\\(\\w+\\))*\\s+(?:of\\s+)?(?:the\\s+)?(?:${labels.map(escapeRegex).join('|')})(?=\\s|[,.;(]|$)`,
          'i'
        );
        if (!pattern.test(text)) continue;
        const summary = pageSummary(judgment, candidate.url);
        links.push({
          title: summary.title,
          url: candidate.url,
          detail: [summary.citation, summary.date].filter(Boolean).join(' · '),
        });
      } catch {
        /* An unavailable candidate does not invalidate other verified matches. */
      }
    }
    return {
      kind: 'Matching judgments',
      title: `Section ${section} · ${act}`,
      text: links.length
        ? 'Verified references in the inspected search results.'
        : 'No matching references verified in the inspected search results.',
      detail: 'Partial live search; not a complete citation history. Versions cited may differ.',
      url,
      links,
    };
  }
}
export function unavailablePreview(ref: Reference, error: unknown): Preview {
  let url = ref.url;
  if (!url && ref.act)
    url = knownActUrl(ref.act) || lookupUrl({ kind: 'statute-search', title: ref.act });
  if (ref.kind === 'citing')
    url = lookupUrl({
      kind: 'case-search',
      phrase: `"${ref.act ?? ''}" "section ${ref.section ?? ''}"`,
    });
  return {
    kind: 'Preview unavailable',
    title: ref.label,
    text:
      error instanceof Error
        ? error.message
        : 'The source could not be loaded. Try again or open the source.',
    url,
  };
}
