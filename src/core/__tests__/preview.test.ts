import { PreviewResolver } from '../preview';
import type { Lookup, Reference } from '@/types';
const source = 'https://sso.agc.gov.sg/Act/MDA1973?WholeDoc=1';
const statute: Reference = {
  kind: 'statute',
  label: 'section 5 of the Misuse of Drugs Act 1973',
  act: 'Misuse of Drugs Act 1973',
  section: '5',
  url: source,
};
function mockFetch(handler: (lookup: Lookup) => string | Promise<string>): jest.Mock {
  const sendMessage = jest.fn(async ({ lookup }: { lookup: Lookup }) => ({
    ok: true,
    html: await handler(lookup),
    url: '',
  }));
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: { runtime: { sendMessage } },
  });
  return sendMessage;
}
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'chrome');
});
it('deduplicates on-demand loads in memory, labels current text and clears on disable', async () => {
  const send = mockFetch(
    () =>
      '<div id="legisContent"><table><tr><td id="pr5-he-">Trafficking</td></tr><tr><td>Provision text.</td></tr></table></div>'
  );
  const resolver = new PreviewResolver();
  const [a, b] = await Promise.all([
    resolver.resolve(statute, source),
    resolver.resolve(statute, source),
  ]);
  expect(a.text).toContain('Provision text');
  expect(a.detail).toContain('Current version');
  expect(a).toEqual(b);
  expect(send).toHaveBeenCalledTimes(1);
  resolver.clear();
  await expect(resolver.resolve(statute, source)).rejects.toThrow('Lookup dismissed');
  await new PreviewResolver().resolve(statute, source);
  expect(send).toHaveBeenCalledTimes(2);
});
it('shows literal current text with a prominent warning when a cited edition cannot be verified', async () => {
  mockFetch(
    () =>
      '<div id="legisContent"><table><tr><td id="pr5-he-">5. Heading</td></tr><tr><td>Current provision wording.</td></tr></table></div>'
  );
  const result = await new PreviewResolver().resolve(
    { ...statute, version: '2008 Rev Ed' },
    source
  );
  expect(result.text).toContain('Current provision wording.');
  expect(result.kind).toBe('Legislation · current text');
  expect(result.detail).toContain('2008 Rev Ed could not be verified');
});
it('retries failed requests, handles blocked content and never invents missing sections', async () => {
  const send = mockFetch(() => 'Access denied');
  const resolver = new PreviewResolver();
  await expect(resolver.resolve(statute, source)).rejects.toThrow('readable legislation');
  send.mockResolvedValue({ ok: false, error: 'HTTP 403' });
  await expect(new PreviewResolver().resolve(statute, source)).rejects.toThrow('HTTP 403');
  await expect(new PreviewResolver().resolve(statute, source)).rejects.toThrow('HTTP 403');
  expect(send).toHaveBeenCalledTimes(6);
});
it('checks live search candidates for the actual Act and section, not section-number prefixes', async () => {
  const send = mockFetch((lookup) => {
    if (lookup.kind === 'case-search')
      return '<a href="/gdviewer/s/2024_SGCA_12">A v B</a><a href="/gdviewer/s/2024_SGCA_13">C v D</a>';
    return `<div id="divJudgement"><div class="HN-NeutralCit">[2024] SGCA 12</div><div class="HN-CaseName">A v B</div><p>s ${lookup.kind === 'document' && lookup.url.includes('_13') ? '50' : '5(1)'} of the Misuse of Drugs Act 1973</p></div>`;
  });
  const result = await new PreviewResolver().resolve(
    { kind: 'citing', label: '5', act: 'Misuse of Drugs Act 1973', section: '5' },
    source
  );
  expect(result.links).toHaveLength(1);
  expect(result.detail).toContain('Partial live search');
  expect(send).toHaveBeenCalledTimes(3);
});
it('searches unknown instruments and refuses ambiguous matches', async () => {
  mockFetch(
    () => '<a href="/Act/OTHER2020">Other Act 2020</a><a href="/Act/OTHER2000">Other Act 2000</a>'
  );
  await expect(
    new PreviewResolver().resolve({ ...statute, url: undefined, act: 'Other Act' }, source)
  ).rejects.toThrow('unique title match');
});
it('resolves a report citation by its printed case name and previews the pinpoint paragraphs', async () => {
  const name = 'L W Infrastructure Pte Ltd v Lim Chin San Contractors Pte Ltd';
  const send = mockFetch((lookup) => {
    if (lookup.kind === 'case-search') {
      expect(lookup.phrase).toBe(name);
      return `<a href="/gdviewer/s/2013_SGHC_264">${name}</a>`;
    }
    return `<div id="divJudgement"><div class="HN-CaseName">${name}</div><div class="HN-NeutralCit">[2013] SGHC 264</div><div class="Judg-1">28 The tribunal has completed its mandate.</div><div class="Judg-1">29 It cannot reconsider the merits.</div></div>`;
  });
  const result = await new PreviewResolver().resolve(
    { kind: 'case', label: '[2014] 1 SLR 1221', caseName: name, paragraphs: ['28', '29'] },
    source
  );
  expect(result.text).toContain('28 The tribunal has completed its mandate.');
  expect(result.text).toContain('29 It cannot reconsider the merits.');
  expect(result.detail).toContain('not independently verified');
  expect(result.url).toContain('2013_SGHC_264');
  expect(send).toHaveBeenCalledTimes(2);
});
it('shows quoted statutory text from the judgment without a remote lookup', async () => {
  const send = mockFetch(() => '');
  const result = await new PreviewResolver().resolve(
    { ...statute, quote: '5.—(1) Exact quoted text.', version: '2020 Rev Ed' },
    'https://www.elitigation.sg/gd/s/2024_SGCA_12'
  );
  expect(result.text).toBe('5.—(1) Exact quoted text.');
  expect(result.kind).toContain('quoted');
  expect(send).not.toHaveBeenCalled();
});
it('reads the rendered source when the HTTP response is only a JavaScript shell', async () => {
  const send = mockFetch((lookup) =>
    lookup.kind === 'rendered'
      ? '<div id="legisContent"><table><tr><td id="pr5-he-">5. Duties</td></tr><tr><td>Browser rendered provision.</td></tr></table></div>'
      : '<div id="legisContent"></div>'
  );
  const result = await new PreviewResolver().resolve(statute, source);
  expect(result.text).toContain('Browser rendered provision.');
  expect(send).toHaveBeenCalledTimes(2);
});
it('uses the edition date explicitly linked from the official timeline', async () => {
  mockFetch((lookup) => {
    const historical = lookup.kind === 'document' && lookup.url.includes('RevDate=20211231');
    return `<ul><li><a href="?RevDate=20211231&WholeDoc=1">31 Dec 2021 · 2020 RevEd</a></li></ul><div id="legisContent"><table><tr><td id="pr5-he-">5. Duties</td></tr><tr><td>${historical ? 'Historical text.' : 'Current text.'}</td></tr></table></div>`;
  });
  const result = await new PreviewResolver().resolve(
    { ...statute, version: '2020 Rev Ed' },
    source
  );
  expect(result.text).toContain('Historical text.');
  expect(result.url).toContain('RevDate=20211231');
});
