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
  await resolver.resolve(statute, source);
  expect(send).toHaveBeenCalledTimes(2);
});
it('does not substitute current text for an explicit historical edition', async () => {
  const send = mockFetch(() => '');
  const result = await new PreviewResolver().resolve(
    { ...statute, version: '2008 Rev Ed' },
    source
  );
  expect(result.text).toContain('historical edition');
  expect(send).not.toHaveBeenCalled();
});
it('retries failed requests, handles blocked content and never invents missing sections', async () => {
  const send = mockFetch(() => 'Access denied');
  const resolver = new PreviewResolver();
  await expect(resolver.resolve(statute, source)).rejects.toThrow('no readable legislation');
  send.mockResolvedValue({ ok: false, error: 'HTTP 403' });
  resolver.clear();
  await expect(resolver.resolve(statute, source)).rejects.toThrow('HTTP 403');
  await expect(resolver.resolve(statute, source)).rejects.toThrow('HTTP 403');
  expect(send).toHaveBeenCalledTimes(3);
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
  ).rejects.toThrow('No unique');
});
