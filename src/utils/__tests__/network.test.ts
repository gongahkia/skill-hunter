import { fetchLookup, isSupportedUrl, lookupUrl } from '../network';
it('restricts document lookups to approved official routes and HTTPS origins', () => {
  for (const url of [
    'https://sso.agc.gov.sg/Act/MDA1973',
    'https://www.elitigation.sg/gd/s/2024_SGCA_12',
    'https://www.elitigation.sg/gdviewer/s/2024_SGCA_12',
  ])
    expect(isSupportedUrl(url)).toBe(true);
  for (const url of [
    'https://evil.test/Act/MDA1973',
    'javascript:alert(1)',
    'https://sso.agc.gov.sg.evil.test/Act/A',
    'https://user:pass@sso.agc.gov.sg/Act/A',
    'https://sso.agc.gov.sg/admin',
    'http://sso.agc.gov.sg/Act/A',
  ]) {
    expect(isSupportedUrl(url)).toBe(false);
    expect(() => lookupUrl({ kind: 'document', url })).toThrow();
  }
  expect(() => lookupUrl({ kind: 'case-search', phrase: 'x'.repeat(301) })).toThrow();
});
it('encodes search phrases without letting them change the route or parameters', () => {
  const url = new URL(lookupUrl({ kind: 'case-search', phrase: '"Penal Code" & Filter=evil' }));
  expect(url.hostname).toBe('www.elitigation.sg');
  expect(url.searchParams.get('Filter')).toBe('SUPCT');
  expect(url.searchParams.get('SearchPhrase')).toContain('& Filter=evil');
});
it('handles 403 and timeouts without storing content', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
  expect(
    await fetchLookup({ kind: 'document', url: 'https://sso.agc.gov.sg/Act/A' })
  ).toMatchObject({ ok: false, error: 'Source returned HTTP 403' });
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(
    (_url, opts) =>
      new Promise((_resolve, reject) =>
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      )
  );
  const pending = fetchLookup({ kind: 'document', url: 'https://sso.agc.gov.sg/Act/A' });
  await jest.advanceTimersByTimeAsync(12001);
  expect(await pending).toMatchObject({ ok: false, error: 'aborted' });
  jest.useRealTimers();
  Reflect.deleteProperty(globalThis, 'fetch');
});
