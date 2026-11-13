import type { FetchResponse, Lookup, Preview, Reference } from '@/types';
import { lookupUrl } from '@/utils/network';
import { actAliases, caseUrl, knownActUrl, normalizeAct } from './references';
import {
  cleanText,
  contentRoot,
  escapeRegex,
  localPreview,
  localTarget,
  pageSummary,
  parseHtml,
  provisionText,
  searchCandidates,
  statuteVersion,
} from './sources';
import { definitionFor, extractDefinitions } from './definitions';

export class PreviewResolver {
  private cache = new Map<string, Promise<Document>>();
  private generation = 0;
  clear(): void {
    this.generation++;
    this.cache.clear();
  }
  private async load(lookup: Lookup): Promise<Document> {
    const key = lookupUrl(lookup);
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
    if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value as string);
    // Failures should be retryable on the next activation.
    void request.catch(() => {
      if (this.cache.get(key) === request) this.cache.delete(key);
    });
    return request;
  }
  private async statuteUrl(ref: Reference): Promise<string> {
    if (ref.url) return ref.url;
    if (!ref.act) throw new Error('The referenced instrument could not be identified');
    const lookup: Lookup = { kind: 'statute-search', title: ref.act };
    const doc = await this.load(lookup);
    const matches = searchCandidates(doc, lookupUrl(lookup)).filter(
      (c) => normalizeAct(c.title).toLowerCase() === normalizeAct(ref.act ?? '').toLowerCase()
    );
    if (matches.length !== 1) throw new Error('No unique matching instrument was found');
    return matches[0]?.url ?? '';
  }
  async resolve(ref: Reference, pageUrl: string): Promise<Preview> {
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
    if (ref.kind === 'citing') return this.citingCases(ref);
    if (ref.kind === 'case') return this.casePreview(ref);
    const sourceUrl = await this.statuteUrl(ref);
    // An explicitly mentioned revised edition cannot be assumed to equal the current Act URL.
    if (
      ref.version &&
      !/\/(?:Act-Rev)\//.test(sourceUrl) &&
      !new URL(sourceUrl).searchParams.has('RevDate')
    ) {
      return {
        kind: 'Legislation',
        title: ref.act || ref.label,
        text: 'The cited historical edition could not be established. Open SSO to select that edition.',
        detail: `Cited edition: ${ref.version}`,
        url: sourceUrl,
      };
    }
    const url = new URL(sourceUrl);
    url.searchParams.set('WholeDoc', '1');
    const doc = await this.load({ kind: 'document', url: url.href });
    const root = contentRoot(doc);
    if (!root) throw new Error('SSO returned no readable legislation (access may be blocked)');
    const summary = pageSummary(doc, url.href);
    if (ref.kind === 'definition') {
      const defs = extractDefinitions(root);
      const scope = ref.section ? localTarget(root, ref.section) : undefined;
      const def = definitionFor(ref.text ?? '', scope ?? root, root, defs);
      if (!def) throw new Error('No unambiguous definition was found in the identified scope');
      return {
        kind: 'Definition',
        title: ref.text ?? ref.label,
        text: def.text,
        detail: statuteVersion(doc, url.href),
        url: url.href,
      };
    }
    const hashSection = /pr(\d+[A-Z]*)(?:-ss(\w+))?/.exec(url.hash);
    const section =
      ref.section ||
      (hashSection ? `${hashSection[1]}${hashSection[2] ? `(${hashSection[2]})` : ''}` : '');
    const target = section ? localTarget(root, section) : undefined;
    if (section && !target)
      throw new Error('The referenced provision was not found in this version');
    if (target?.id) url.hash = target.id;
    return {
      kind: 'Legislation',
      title: summary.title,
      text: target
        ? provisionText(target)
        : cleanText(root.querySelector('.longTitle')) || 'Open the source to read this instrument.',
      detail: `${section ? `Section ${section}. ` : ''}${statuteVersion(doc, url.href)}`,
      url: url.href,
    };
  }
  private async casePreview(ref: Reference): Promise<Preview> {
    let url = ref.url || caseUrl(ref.label);
    if (!url) {
      const lookup: Lookup = { kind: 'case-search', phrase: `"${ref.label}"` };
      const search = await this.load(lookup);
      for (const candidate of searchCandidates(search, lookupUrl(lookup)).slice(0, 5)) {
        const doc = await this.load({ kind: 'document', url: candidate.url });
        const head = doc.querySelector('#divJudgement');
        // Only accept a report citation in the case's own header, not a citation in its reasons.
        const citationHeader = head?.querySelector('.HN-NeutralCit, .HN-CaseName')?.parentElement;
        const preamble = citationHeader
          ? Array.from(citationHeader.children)
              .filter((el) => !el.className.startsWith('Judg-'))
              .map(cleanText)
              .join(' ')
          : '';
        if (preamble.includes(ref.label)) {
          url = candidate.url;
          break;
        }
      }
      if (!url)
        return {
          kind: 'Case citation',
          title: ref.label,
          text: 'No verified public judgment mapping was found for this report citation.',
          url: lookupUrl(lookup),
        };
    }
    const doc = await this.load({ kind: 'document', url });
    if (!doc.querySelector('#divJudgement')) throw new Error('No public judgment was returned');
    const summary = pageSummary(doc, url);
    return {
      kind: 'Judgment',
      title: summary.title,
      text: summary.citation,
      detail: [summary.court, summary.date].filter(Boolean).join(' · '),
      url,
    };
  }
  private async citingCases(ref: Reference): Promise<Preview> {
    const act = normalizeAct(ref.act ?? '');
    const section = ref.section ?? '';
    const phrase = `"${act.replace(/"/g, '')}" AND ("section ${section}" OR "s ${section}" OR "s. ${section}")`;
    const lookup: Lookup = { kind: 'case-search', phrase };
    const url = lookupUrl(lookup);
    const doc = await this.load(lookup);
    const candidates = searchCandidates(doc, url).slice(0, 5);
    const links: NonNullable<Preview['links']> = [];
    for (const candidate of candidates) {
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
